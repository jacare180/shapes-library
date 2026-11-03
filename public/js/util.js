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
// The "Moderno" look (Hallmark's Ink): flat, modern colours instead of leather.
export const MODERN = ["#2b50c8", "#c9371f", "#f2cf3f", "#5cc49a", "#1f1f1f", "#f0a6a6", "#16706d", "#9b7fd9", "#ece6d6", "#f08a3c", "#23305e", "#8c9a3c"];
export const MODERN_THEME_DEFAULTS = {
  "Filosofia política": "#2b50c8",
  "Economia": "#5cc49a",
  "Ciência": "#f08a3c",
  "IA": "#9b7fd9",
  "Judaísmo": "#f2cf3f",
  "Negócios": "#c9371f",
  "Mente": "#f0a6a6",
};

// Switch the look: the attribute the CSS reads, the browser chrome colour, and this device's memory
// (an inline script in index.html reads it back before the first paint, so the page never flashes).
export function applyLook(l) {
  const on = l === "moderno" ? "moderno" : "classico";
  document.documentElement.dataset.theme = on;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", on === "moderno" ? "#fdfdfb" : "#1c120b");
  try { localStorage.setItem("shapes-look", on); } catch {}
}

// Which look is on: "classico" (leather and brass) or "moderno". Set on <html data-theme>.
export const look = () => (document.documentElement.dataset.theme === "moderno" ? "moderno" : "classico");
const palette = () => (look() === "moderno" ? MODERN : LEATHER);

let themeColors = { classico: { ...THEME_DEFAULTS }, moderno: { ...MODERN_THEME_DEFAULTS } };
export const setThemeColors = (custom, customModern) => {
  themeColors = { classico: { ...THEME_DEFAULTS, ...(custom || {}) }, moderno: { ...MODERN_THEME_DEFAULTS, ...(customModern || {}) } };
};
export const themeColor = (theme) => themeColors[look()][theme] || palette()[hash(theme) % palette().length];
export const leather = (book) => {
  // a colour chosen for the book belongs to the look it was chosen in
  if (book.color && (look() === "moderno") === MODERN.includes(book.color)) return book.color;
  const first = (book.tags || []).find(Boolean);
  return first ? themeColor(first) : palette()[hash(book.id + book.title) % palette().length];
};

// Text on a spine: whichever of dark ink or white reads better on its colour.
export function inkOn(hex) {
  const c = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(c >> 16) + 0.7152 * lin((c >> 8) & 255) + 0.0722 * lin(c & 255);
  const onWhite = 1.05 / (L + 0.05), onDark = (L + 0.05) / (0.0137 + 0.05);
  return onDark >= onWhite ? "#1f1f1f" : "#fdfdfb";
}

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
