// Talks to /api and keeps the library in memory. The last copy is cached in localStorage,
// so the shelf shows at once (and offline); the server is always the source of truth.
import { rid, toast, today, setThemeColors } from "./util.js";
import { googleURL, openLibraryURL, fromGoogle, fromOpenLibrary, fetchJSON, merge } from "./catalog.js";

const KEY = "shapes-key";
const CACHE = "shapes-cache";
const listeners = new Set();

export const S = { books: [], reads: [], notes: [], goals: {}, config: {}, loaded: false };

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
export const getKey = () => safe(() => localStorage.getItem(KEY)) || "";
export const setKey = (k) => safe(() => (k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY)));

// Invite link /?k=CODE: keep the key on this device and drop it from the address bar.
export function takeKeyFromUrl() {
  const u = new URL(location.href);
  const k = u.searchParams.get("k");
  if (!k) return;
  setKey(k);
  u.searchParams.delete("k");
  history.replaceState(null, "", u.pathname + u.search + u.hash);
}

export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

function apply(data) {
  Object.assign(S, data, { loaded: true });
  setThemeColors(S.config.themeColors);
  S.reads.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  safe(() => localStorage.setItem(CACHE, JSON.stringify(data)));
  emit();
}

export function loadCache() {
  const c = safe(() => JSON.parse(localStorage.getItem(CACHE)));
  if (c) { Object.assign(S, c, { loaded: true }); setThemeColors(S.config?.themeColors); emit(); }
}

async function call(path, opts = {}) {
  const r = await fetch(`/api/${path}`, { ...opts, headers: { "content-type": "application/json", "x-library-key": getKey(), ...opts.headers } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || r.status), { status: r.status });
  return body;
}

export async function refresh() {
  apply(await call("state"));
}

// The page asks both catalogs itself and the Worker at the same time; a catalog only counts as
// failed when neither path got an answer from it.
export async function search(q) {
  const server = call(`search?q=${encodeURIComponent(q)}`);
  if (S.fakeSearch) return server;
  const [gb, ol, sv] = await Promise.allSettled([
    fetchJSON(googleURL(q)).then(fromGoogle),
    fetchJSON(openLibraryURL(q), 12000).then(fromOpenLibrary),
    server,
  ]);
  const serverFailed = sv.status === "fulfilled" ? sv.value.failed.map((f) => f.name) : ["Google Books", "Open Library"];
  const failed = [["Google Books", gb], ["Open Library", ol]]
    .filter(([name, r]) => r.status === "rejected" && serverFailed.includes(name))
    .map(([name, r]) => ({ name, reason: r.reason.message }));
  return { results: merge([gb.value || [], ol.value || [], sv.value?.results || []]), failed };
}

const COLL = { books: "books", reads: "reads", notes: "notes" };

// Optimistic: the screen changes at once; if the server refuses, reload the truth.
export async function write(op, path, data) {
  const [c, id] = path.split("/");
  if (COLL[c]) {
    const list = S[c];
    const i = list.findIndex((d) => d.id === id);
    if (op === "delete") { if (i >= 0) list.splice(i, 1); }
    else if (i >= 0) list[i] = op === "set" ? { id, ...data } : { ...list[i], ...data };
    else list.push({ id, ...data });
  } else if (c === "goals") {
    S.goals[id] = op === "delete" ? undefined : { ...(op === "update" ? S.goals[id] : {}), ...data };
  } else if (c === "config") {
    S.config[id] = { ...(op === "update" ? S.config[id] : {}), ...data };
    if (id === "themeColors") setThemeColors(S.config.themeColors);
  }
  emit();
  try {
    await call("write", { method: "POST", body: JSON.stringify({ op, path, data }) });
    safe(() => localStorage.setItem(CACHE, JSON.stringify(S)));
  } catch (e) {
    toast("Não consegui salvar. Confira a conexão.", "bad");
    refresh().catch(() => {});
    throw e;
  }
}

// A backup file (or books brought from elsewhere) in the same shape the backup button saves.
export async function importLibrary(file) {
  const docs = [];
  for (const c of ["books", "reads", "notes"]) for (const { id, ...d } of file[c] || []) if (id) docs.push({ path: `${c}/${id}`, data: d });
  for (const [k, v] of Object.entries(file.goals || {})) if (v) docs.push({ path: `goals/${k}`, data: v });
  for (const [k, v] of Object.entries(file.config || {})) if (v) docs.push({ path: `config/${k}`, data: v });
  if (!docs.length) throw new Error("empty");
  for (let i = 0; i < docs.length; i += 400) await call("import", { method: "POST", body: JSON.stringify({ docs: docs.slice(i, i + 400) }) });
  await refresh();
  return (file.books || []).length;
}

// Priority on the "Lendo agora" and "Quero ler" shelves: the ids in their new order, saved in one batch.
export async function saveOrder(ids) {
  const docs = [];
  ids.forEach((id, i) => {
    const b = bookById(id);
    if (!b || b.order === i + 1) return;
    b.order = i + 1;
    const { id: _drop, ...data } = b;
    docs.push({ path: `books/${id}`, data });
  });
  if (!docs.length) return;
  emit();
  try {
    await call("import", { method: "POST", body: JSON.stringify({ docs }) });
    safe(() => localStorage.setItem(CACHE, JSON.stringify(S)));
  } catch {
    toast("Não consegui salvar a nova ordem.", "bad");
    refresh().catch(() => {});
  }
}

// FilosoX references in a book's connections text: "#019 (tradição como...), #020" gives
// [{ code: "019", label: "tradição como..." }, { code: "020", label: "" }].
export function ideasOf(book) {
  const out = [];
  for (const m of (book.connections || "").matchAll(/#(\d{2,4})\s*(?:\(([^)]*)\))?/g)) {
    if (!out.some((x) => x.code === m[1])) out.push({ code: m[1], label: (m[2] || "").trim() });
  }
  return out;
}

// The Notion import kept "Por que ler" and "Conexões no registro" as notes; they now have their own
// fields on the book. Runs once per note (the note is removed after its text moves).
const MOVE = [["Por que ler: ", "why"], ["Conexões no registro (FilosoX): ", "connections"]];
export async function moveNotesToFields() {
  const moves = [];
  for (const n of S.notes) {
    const hit = MOVE.find(([prefix]) => (n.text || "").startsWith(prefix));
    const b = hit && bookById(n.bookId);
    if (b && !b[hit[1]]) moves.push({ n, b, field: hit[1], text: n.text.slice(hit[0].length).trim() });
  }
  if (!moves.length) return 0;
  for (const { b, field, text } of moves) b[field] = text;
  const books = [...new Set(moves.map((m) => m.b))];
  await call("import", { method: "POST", body: JSON.stringify({ docs: books.map(({ id, ...data }) => ({ path: `books/${id}`, data })) }) });
  for (const { n } of moves) await call("write", { method: "POST", body: JSON.stringify({ op: "delete", path: `notes/${n.id}` }) });
  await refresh();
  return moves.length;
}

// ---- reading helpers ----
export const readsOf = (bookId) => S.reads.filter((r) => r.bookId === bookId);
export const currentRead = (bookId) => readsOf(bookId).at(-1) || null;
export const notesOf = (bookId) => S.notes.filter((n) => n.bookId === bookId);
export const bookById = (id) => S.books.find((b) => b.id === id);
// Reading progress in %: from the page when the book has a page count, otherwise the % typed in
// (e-readers show %, and imported books may not have a page count yet).
export function progressOf(book, read) {
  if (!read) return null;
  if (book.pages && read.page > 0) return Math.min(100, Math.round((100 * read.page) / book.pages));
  if (read.pct != null) return read.pct;
  return book.pages ? 0 : null;
}
export const criteriaFor = (kind) => (S.config.criteria || {})[kind] || [];

export async function addBook(book, status) {
  const id = rid();
  const now = Date.now();
  await write("set", `books/${id}`, { ...book, createdAt: now });
  await newRead(id, status);
  return id;
}

export function newRead(bookId, status = "quero") {
  const t = today();
  return write("set", `reads/${rid()}`, {
    bookId, status, page: 0, ratings: {}, overall: null, review: "", createdAt: Date.now(),
    start: status === "lendo" || status === "lido" ? t : "", end: status === "lido" ? t : "",
  });
}
