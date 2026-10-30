// ShapeX Library API on Cloudflare Workers + D1. The static site in public/ is served by Workers assets;
// only /api/* reaches this code (see run_worker_first in wrangler.jsonc).
// Everything is private: every route needs the owner's key (x-library-key header), stored as the
// secret KEY_OWNER, never in the repo.

import { googleURL, openLibraryURL, fromGoogle, fromOpenLibrary, fetchJSON, merge } from "../public/js/catalog.js";

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
  if (env.SHAPES_FAKE_SEARCH) out.fakeSearch = true; // local runs: the page asks the sample catalog through the Worker
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

// Many documents at once (restoring a backup, bringing books from elsewhere). Same paths overwrite,
// so importing the same file twice never duplicates anything.
async function importDocs(req, env) {
  const { docs } = await req.json().catch(() => ({}));
  if (!Array.isArray(docs) || !docs.length || docs.length > 500) return json({ error: "bad docs" }, 400);
  const bad = docs.find(({ path, data }) => !KEY_RE.test(path || "") || !data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > MAX_DOC);
  if (bad) return json({ error: "bad doc", path: bad.path }, 400);
  const d = await db(env);
  const now = Date.now();
  const stmt = d.prepare("INSERT INTO docs (path, coll, data, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(path) DO UPDATE SET data = ?3, updated_at = ?4");
  await d.batch(docs.map(({ path, data }) => {
    const { id: _drop, ...rest } = data;
    return stmt.bind(path, path.split("/")[0], JSON.stringify({ ...rest, updatedAt: now }), now);
  }));
  return json({ ok: true, count: docs.length });
}

// Fallback for the page's own search, and the only place a GOOGLE_BOOKS_KEY is used.
async function search(q, env) {
  q = (q || "").trim().slice(0, 200);
  if (!q) return json({ results: [], failed: [] });
  if (env.SHAPES_FAKE_SEARCH) {
    const { fakeSearch } = await import("./sample-search.js");
    return json({ results: fakeSearch(q), failed: [] });
  }
  const ua = { "user-agent": "ShapeXLibrary/1.0 (personal reading log)" };
  const [gb, ol] = await Promise.allSettled([
    fetchJSON(googleURL(q, env.GOOGLE_BOOKS_KEY), 10000, ua).then(fromGoogle),
    fetchJSON(openLibraryURL(q), 12000, ua).then(fromOpenLibrary),
  ]);
  const failed = [["Google Books", gb], ["Open Library", ol]].filter(([, r]) => r.status === "rejected").map(([name, r]) => ({ name, reason: r.reason.message }));
  return json({ results: merge([gb.value || [], ol.value || []]), failed });
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
      if (req.method === "POST" && path === "import") return await importDocs(req, env);
      if (req.method === "GET" && path === "search") return await search(url.searchParams.get("q"), env);
      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "server error" }, 500);
    }
  },
};
