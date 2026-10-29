// Shapes Library API on Cloudflare Workers + D1. The static site in public/ is served by Workers assets;
// only /api/* reaches this code (see run_worker_first in wrangler.jsonc).
// Everything is private: every route needs the owner's key (x-library-key header), stored as the
// secret KEY_OWNER, never in the repo.

const KEY_RE = /^(books|reads|notes|goals|config)\/[A-Za-z0-9_\-.]{1,80}$/;
const MAX_DOC = 100_000;

export const DEFAULT_CRITERIA = {
  ficcao: ["Escrita", "Enredo", "Personagens", "Ritmo", "Impacto emocional", "Vontade de reler"],
  "nao-ficcao": ["Clareza", "Profundidade", "Aplicabilidade", "Originalidade", "Vontade de reler"],
};

// One row per document (each book, reading, note), so writes from the PC and the phone never
// overwrite each other, and the whole library still loads in a single query.
const SCHEMA = `CREATE TABLE IF NOT EXISTS docs (
  path TEXT PRIMARY KEY,
  coll TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;
let ready = null;
const db = (env) => (ready ||= env.DB.prepare(SCHEMA).run().catch((e) => { ready = null; throw e; })).then(() => env.DB);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function authorized(req, env) {
  const enc = new TextEncoder();
  const a = enc.encode(env.KEY_OWNER || ""), b = enc.encode(req.headers.get("x-library-key") || "");
  return a.length > 0 && a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}

async function state(env) {
  const { results } = await (await db(env)).prepare("SELECT path, coll, data FROM docs").all();
  const out = { books: [], reads: [], notes: [], goals: {}, config: { criteria: DEFAULT_CRITERIA } };
  for (const row of results) {
    const id = row.path.split("/")[1];
    const v = JSON.parse(row.data);
    if (row.coll === "books" || row.coll === "reads" || row.coll === "notes") out[row.coll].push({ id, ...v });
    else if (row.coll === "goals") out.goals[id] = v;
    else if (row.coll === "config") out.config[id] = v;
  }
  out.books = out.books.filter((b) => !b.deleted);
  const live = new Set(out.books.map((b) => b.id));
  out.reads = out.reads.filter((r) => live.has(r.bookId));
  out.notes = out.notes.filter((n) => live.has(n.bookId));
  return json(out);
}

async function write(req, env) {
  const { op, path, data } = await req.json().catch(() => ({}));
  if (!KEY_RE.test(path || "")) return json({ error: "bad path" }, 400);
  const d = await db(env);
  if (op === "delete") {
    await d.prepare("DELETE FROM docs WHERE path = ?").bind(path).run();
    return json({ ok: true });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad data" }, 400);
  if (JSON.stringify(data).length > MAX_DOC) return json({ error: "too big" }, 413);
  const { id: _drop, ...rest } = data;
  let doc = rest;
  if (op === "update") {
    const cur = await d.prepare("SELECT data FROM docs WHERE path = ?").bind(path).first("data");
    if (!cur) return json({ error: "not found" }, 404);
    doc = { ...JSON.parse(cur), ...rest };
  } else if (op !== "set") return json({ error: "bad op" }, 400);
  doc.updatedAt = Date.now();
  await d.prepare("INSERT INTO docs (path, coll, data, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(path) DO UPDATE SET data = ?3, updated_at = ?4")
    .bind(path, path.split("/")[0], JSON.stringify(doc), doc.updatedAt).run();
  return json({ ok: true, doc: { id: path.split("/")[1], ...doc } });
}

const fetchJSON = (url) =>
  fetch(url, { signal: AbortSignal.timeout(7000), headers: { "user-agent": "ShapesLibrary/1.0" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))));

async function openLibrary(q) {
  const fields = "title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,subject";
  const d = await fetchJSON(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=${fields}`);
  return (d.docs || []).map((b) => ({
    title: b.title || "",
    authors: b.author_name || [],
    year: b.first_publish_year || null,
    pages: b.number_of_pages_median || null,
    cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : "",
    isbn: (b.isbn || [])[0] || "",
    genre: (b.subject || [])[0] || "",
    source: "Open Library",
  }));
}

async function googleBooks(q, env) {
  const key = env.GOOGLE_BOOKS_KEY ? `&key=${env.GOOGLE_BOOKS_KEY}` : "";
  const d = await fetchJSON(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books${key}`);
  return (d.items || []).map(({ volumeInfo: v = {} }) => ({
    title: [v.title, v.subtitle].filter(Boolean).join(": "),
    authors: v.authors || [],
    year: parseInt(v.publishedDate, 10) || null,
    pages: v.pageCount || null,
    cover: (v.imageLinks?.thumbnail || "").replace(/^http:/, "https:"),
    isbn: (v.industryIdentifiers || []).find((i) => i.type === "ISBN_13")?.identifier || "",
    genre: (v.categories || [])[0] || "",
    source: "Google Books",
  }));
}

// Both catalogs at once; one failing (down, quota) never blocks the other.
async function search(q, env) {
  q = (q || "").trim().slice(0, 200);
  if (!q) return json({ results: [] });
  if (env.SHAPES_FAKE_SEARCH) {
    const { fakeSearch } = await import("./sample-search.js");
    return json({ results: fakeSearch(q), failed: [] });
  }
  const [gb, ol] = await Promise.allSettled([googleBooks(q, env), openLibrary(q)]);
  const all = [...(gb.value || []), ...(ol.value || [])].filter((b) => b.title);
  const seen = new Set();
  const results = all.filter((b) => {
    const k = `${b.title.toLowerCase()}|${(b.authors[0] || "").toLowerCase()}`;
    return seen.has(k) ? false : seen.add(k);
  });
  const failed = [gb.status === "rejected" && "Google Books", ol.status === "rejected" && "Open Library"].filter(Boolean);
  return json({ results, failed });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/?/, "");
    if (!env.KEY_OWNER) return json({ error: "no key configured" }, 503);
    if (!authorized(req, env)) return json({ error: "wrong key" }, 401);
    try {
      if (req.method === "GET" && path === "state") return await state(env);
      if (req.method === "POST" && path === "write") return await write(req, env);
      if (req.method === "GET" && path === "search") return await search(url.searchParams.get("q"), env);
      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "server error" }, 500);
    }
  },
};
