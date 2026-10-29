// The bookcase: one shelf per reading status, books standing with their spines out.
import { S, currentRead } from "./api.js";
import { esc, hash, leather, STATUS } from "./util.js";

const ORDER = ["lendo", "lido", "quero", "abandonado"];

// Size on the shelf: thickness follows the page count, height varies a little per book.
export function spineSize(book) {
  const w = Math.round(Math.max(24, Math.min(64, 16 + (book.pages || 220) / 12)));
  const h = 150 + (hash(book.id) % 38);
  return { w, h };
}

export function spineHTML(book, read, { hidden = false } = {}) {
  const { w, h } = spineSize(book);
  const pct = read?.status === "lendo" && book.pages ? Math.min(100, Math.round((100 * (read.page || 0)) / book.pages)) : null;
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
      <input class="find" type="search" placeholder="Procurar por título, autor, gênero ou tag" value="${esc(filter)}" aria-label="Procurar na estante">
    </div>
    <div class="shelves"></div>`;
  fillShelves(view, filter);
}

// Only the shelves redraw while typing in the search box, so it keeps focus.
export function fillShelves(view, filter = "") {
  const q = filter.trim().toLowerCase();
  const groups = Object.fromEntries(ORDER.map((s) => [s, []]));
  for (const b of S.books) {
    const r = currentRead(b.id);
    const hay = [b.title, ...(b.authors || []), b.genre, ...(b.tags || [])].join(" ").toLowerCase();
    if (q && !hay.includes(q)) continue;
    groups[r?.status || "quero"].push({ b, r });
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
  view.querySelector(".shelves").innerHTML = ORDER.map(shelf).join("");
}
