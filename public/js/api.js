// Talks to /api and keeps the library in memory. The last copy is cached in localStorage,
// so the shelf shows at once (and offline); the server is always the source of truth.
import { rid, toast, today } from "./util.js";

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
  S.reads.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  safe(() => localStorage.setItem(CACHE, JSON.stringify(data)));
  emit();
}

export function loadCache() {
  const c = safe(() => JSON.parse(localStorage.getItem(CACHE)));
  if (c) { Object.assign(S, c, { loaded: true }); emit(); }
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

export const search = (q) => call(`search?q=${encodeURIComponent(q)}`);

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

// ---- reading helpers ----
export const readsOf = (bookId) => S.reads.filter((r) => r.bookId === bookId);
export const currentRead = (bookId) => readsOf(bookId).at(-1) || null;
export const notesOf = (bookId) => S.notes.filter((n) => n.bookId === bookId);
export const bookById = (id) => S.books.find((b) => b.id === id);
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
