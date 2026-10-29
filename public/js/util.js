export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Leather bindings: the spine colour comes from the book unless one was chosen.
export const LEATHER = ["#6e1f24", "#2f4a33", "#1f3550", "#7a5a1e", "#4a2a3d", "#5b3a24", "#2d4f4f", "#8a3b1c", "#3b3b5c", "#55602a"];
export const leather = (book) => book.color || LEATHER[hash(book.id + book.title) % LEATHER.length];

// Local date (an ISO string would be tomorrow's date on a Brazilian evening).
export const today = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export const STATUS = {
  lendo: "Lendo agora",
  quero: "Quero ler",
  lido: "Lido",
  abandonado: "Abandonado",
};
export const KINDS = { ficcao: "Ficção", "nao-ficcao": "Não ficção" };
export const NOTE_TYPES = { citacao: "Citação", reflexao: "Reflexão", resumo: "Resumo" };

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3200);
}

export const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const fmtScore = (n) => (n == null ? "" : n.toFixed(1).replace(".", ","));
