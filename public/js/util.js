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

// Leather bindings. A spine takes, in order: the colour chosen for the book, the colour of its first
// theme, or one picked from the palette by its id.
export const LEATHER = ["#6e1f24", "#2f4a33", "#1f3550", "#7a5a1e", "#4a2a3d", "#5b3a24", "#2d4f4f", "#8a3b1c", "#3b3b5c", "#55602a"];
// Leather versions of the theme colours from the old Notion shelf; any theme can be recoloured in Ajustes.
export const THEME_DEFAULTS = {
  "Filosofia política": "#25406a",
  "Economia": "#2f5a3a",
  "Ciência": "#8a4f1e",
  "IA": "#4b3570",
  "Judaísmo": "#7a5f16",
  "Negócios": "#7a2a24",
  "Mente": "#6b2d55",
};
let themeColors = { ...THEME_DEFAULTS };
export const setThemeColors = (custom) => { themeColors = { ...THEME_DEFAULTS, ...(custom || {}) }; };
export const themeColor = (theme) => themeColors[theme] || LEATHER[hash(theme) % LEATHER.length];
export const leather = (book) => {
  if (book.color) return book.color;
  const first = (book.tags || []).find(Boolean);
  return first ? themeColor(first) : LEATHER[hash(book.id + book.title) % LEATHER.length];
};

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
