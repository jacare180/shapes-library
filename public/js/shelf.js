// The bookcase: one shelf per reading status, or every book grouped by theme with dividers between
// the themes. Books stand with their spines out.
import { S, currentRead, progressOf } from "./api.js";
import { esc, hash, leather, STATUS } from "./util.js";

const VIEW_KEY = "shapes-shelf-view";
let mode = (() => { try { return localStorage.getItem(VIEW_KEY) === "temas" ? "temas" : "situacao"; } catch { return "situacao"; } })();

// A wooden divider standing on the shelf with the name of what follows (a theme, a year).
export const dividerHTML = (label, count) =>
  `<div class="slot divider-slot"><span class="divider" role="separator" aria-label="${esc(label)}"><b>${esc(label)}</b>${count != null ? `<small>${count}</small>` : ""}</span></div>`;

export const themesOf = (b) => (b.tags || []).filter(Boolean);

const ORDER = ["lendo", "lido", "quero", "abandonado"];

// Size on the shelf: thickness follows the page count, height varies a little per book.
export function spineSize(book) {
  const w = Math.round(Math.max(24, Math.min(64, 16 + (book.pages || 220) / 12)));
  const h = 214 + (hash(book.id) % 44); // tall enough to read most titles
  return { w, h };
}

export function spineHTML(book, read, { hidden = false } = {}) {
  const { w, h } = spineSize(book);
  const pct = read?.status === "lendo" ? progressOf(book, read) : null;
  const author = (book.authors || [])[0] || "";
  const surname = author.split(" ").at(-1);
  return `<button class="spine${hidden ? " out" : ""}" type="button" data-id="${esc(book.id)}"
      style="--c:${leather(book)};--w:${w}px;--h:${h}px" aria-label="${esc(book.title)}${author ? ", " + esc(author) : ""}">
    <span class="band"></span>
    <span class="s-title">${esc(book.title)}</span>
    <span class="s-author">${esc(surname)}</span>
    <span class="band"></span>
    ${pct != null ? `<span class="ribbon" title="${pct}% lido"><i style="--p:${pct}%"></i></span>` : ""}
  </button>`;
}

export function renderShelves(view, filter = "") {
  view.innerHTML = `
    <div class="shelf-head">
      <p class="tally"></p>
      <div class="view-switch" role="group" aria-label="Organizar a estante">
        <button type="button" data-view="situacao" aria-pressed="${mode === "situacao"}">Por situação</button>
        <button type="button" data-view="temas" aria-pressed="${mode === "temas"}">Por tema</button>
      </div>
      <input class="find" type="search" placeholder="Procurar por título, autor, gênero ou tag" value="${esc(filter)}" aria-label="Procurar na estante">
    </div>
    <div class="shelves"></div>`;
  view.querySelector(".view-switch").onclick = (e) => {
    const b = e.target.closest("[data-view]");
    if (!b || b.dataset.view === mode) return;
    mode = b.dataset.view;
    try { localStorage.setItem(VIEW_KEY, mode); } catch {}
    view.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    fillShelves(view, view.querySelector(".find").value);
  };
  fillShelves(view, filter);
}

// Every book, theme after theme along one bookcase; a book with two themes stands in both.
function themeShelves(books, q) {
  const byTheme = new Map();
  for (const b of books) for (const t of themesOf(b).length ? themesOf(b) : [""]) {
    if (!byTheme.has(t)) byTheme.set(t, []);
    byTheme.get(t).push(b);
  }
  const themes = [...byTheme.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt"));
  if (byTheme.has("")) themes.push("");
  const body = themes.map((t) => {
    const list = byTheme.get(t).sort((x, y) => x.title.localeCompare(y.title, "pt"));
    return dividerHTML(t || "Sem tema", list.length) + list.map((b) => `<div class="slot">${spineHTML(b, currentRead(b.id))}</div>`).join("");
  }).join("");
  return `<section class="shelf by-theme">
      <h2 class="label"><span>Temas</span><small>${themes.filter(Boolean).length}</small></h2>
      ${body ? `<div class="case"><div class="books">${body}</div></div>` : `<p class="hint">Nenhum livro encontrado${q ? " para essa busca" : ""}.</p>`}
      ${byTheme.has("") ? `<p class="hint">Os temas de cada livro ficam em Editar dados.</p>` : ""}
    </section>`;
}

// Only the shelves redraw while typing in the search box, so it keeps focus.
export function fillShelves(view, filter = "") {
  const q = filter.trim().toLowerCase();
  const groups = Object.fromEntries(ORDER.map((s) => [s, []]));
  const shown = [];
  for (const b of S.books) {
    const r = currentRead(b.id);
    const hay = [b.title, ...(b.authors || []), b.genre, ...(b.tags || [])].join(" ").toLowerCase();
    if (q && !hay.includes(q)) continue;
    groups[r?.status || "quero"].push({ b, r });
    shown.push(b);
  }
  groups.lendo.sort((x, y) => (y.r?.updatedAt || 0) - (x.r?.updatedAt || 0) || (y.b.createdAt || 0) - (x.b.createdAt || 0));
  groups.lido.sort((x, y) => (y.r?.end || "").localeCompare(x.r?.end || ""));
  groups.quero.sort((x, y) => (y.b.createdAt || 0) - (x.b.createdAt || 0));

  const year = new Date().getFullYear();
  const readThisYear = S.reads.filter((r) => r.status === "lido" && (r.end || "").startsWith(year)).length;
  const total = S.books.length;

  const shelf = (status) => {
    const items = groups[status];
    if (status === "abandonado" && !items.length) return "";
    const spines = items.map(({ b, r }) => `<div class="slot">${spineHTML(b, r)}</div>`).join("");
    const add = q ? "" : `<div class="slot"><button class="spine ghost" type="button" data-add="${status}" aria-label="Novo livro em ${STATUS[status]}">+</button></div>`;
    return `<section class="shelf" data-status="${status}">
      <h2 class="label"><span>${STATUS[status]}</span><small>${items.length}</small></h2>
      <div class="case"><div class="books">${spines}${add}</div></div>
    </section>`;
  };

  const lendo = S.reads.filter((r) => r.status === "lendo" && currentRead(r.bookId) === r).length;
  view.querySelector(".tally").textContent = total
    ? `${total} ${total === 1 ? "livro" : "livros"} na estante · ${lendo} em leitura · ${readThisYear} ${readThisYear === 1 ? "lido" : "lidos"} em ${year}`
    : "A estante está vazia. Comece pelo primeiro livro.";
  view.querySelector(".shelves").innerHTML = mode === "temas" ? themeShelves(shown, q) : ORDER.map(shelf).join("");
}
