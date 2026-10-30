// The bookcase: one shelf per reading status, or every book grouped by theme with dividers between
// the themes. Books stand with their spines out.
import { S, currentRead, progressOf, ideasOf, saveOrder } from "./api.js";
import { esc, hash, leather, themeColor, STATUS } from "./util.js";

const VIEW_KEY = "shapes-shelf-view";
const VIEWS = { situacao: "Por situação", temas: "Por tema", ideias: "Por ideia" };
let mode = (() => { try { const v = localStorage.getItem(VIEW_KEY); return VIEWS[v] ? v : "situacao"; } catch { return "situacao"; } })();
export function showView(view, m, filter = "") {
  mode = m;
  try { localStorage.setItem(VIEW_KEY, mode); } catch {}
  renderShelves(view, filter);
}

// A wooden divider standing on the shelf with the name of what follows (a theme, a year).
export const dividerHTML = (label, count, { color, title } = {}) =>
  `<div class="slot divider-slot"><span class="divider" role="separator" aria-label="${esc(title || label)}"${title ? ` title="${esc(title)}"` : ""}${color ? ` style="--tc:${color}"` : ""}><b>${esc(label)}</b>${count != null ? `<small>${count}</small>` : ""}</span></div>`;

export const themesOf = (b) => (b.tags || []).filter(Boolean);

const ORDER = ["lendo", "lido", "quero", "abandonado"];

// Size on the shelf: thickness follows the page count, height varies a little per book.
export function spineSize(book) {
  const w = Math.round(Math.max(24, Math.min(64, 16 + (book.pages || 220) / 12)));
  const h = 214 + (hash(book.id) % 44); // tall enough to read most titles
  return { w, h };
}

// The two shelves with a priority order: chosen order first (1, 2, 3...), then the rest, newest first.
export const QUEUES = ["lendo", "quero"];
export const byPriority = (x, y) => (x.order ?? Infinity) - (y.order ?? Infinity) || (y.createdAt || 0) - (x.createdAt || 0);

export function spineHTML(book, read, { hidden = false, prio = null } = {}) {
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
    ${prio != null ? `<span class="prio" title="Prioridade ${prio}">${prio}</span>` : ""}
  </button>`;
}

export function renderShelves(view, filter = "") {
  view.innerHTML = `
    <div class="shelf-head">
      <p class="tally"></p>
      <div class="view-switch" role="group" aria-label="Organizar a estante">
        ${Object.entries(VIEWS).map(([k, v]) => `<button type="button" data-view="${k}" aria-pressed="${mode === k}">${v}</button>`).join("")}
      </div>
      <input class="find" type="search" placeholder="Procurar por título, autor, tema ou #ideia" value="${esc(filter)}" aria-label="Procurar na estante">
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
    return dividerHTML(t || "Sem tema", list.length, { color: t ? themeColor(t) : null }) + list.map((b) => `<div class="slot">${spineHTML(b, currentRead(b.id))}</div>`).join("");
  }).join("");
  return `<section class="shelf by-theme">
      <h2 class="label"><span>Temas</span><small>${themes.filter(Boolean).length}</small></h2>
      ${body ? `<div class="case"><div class="books">${body}</div></div>` : `<p class="hint">Nenhum livro encontrado${q ? " para essa busca" : ""}.</p>`}
      ${byTheme.has("") ? `<p class="hint">Os temas de cada livro ficam em Editar dados.</p>` : ""}
    </section>`;
}

// Every book that points to an idea of the FilosoX register, idea after idea. Searching "#026" (or
// tapping #026 on a book) shows only that idea.
function ideaShelves(books, q) {
  const only = (q.match(/^#?(\d{2,4})$/) || [])[1];
  const byIdea = new Map();
  for (const b of S.books) for (const { code, label } of ideasOf(b)) {
    if (only ? code !== only : !books.includes(b)) continue;
    if (!byIdea.has(code)) byIdea.set(code, []);
    byIdea.get(code).push({ b, label });
  }
  const codes = [...byIdea.keys()].sort((a, b) => +a - +b);
  const body = codes.map((code) => {
    const list = byIdea.get(code);
    const labels = [...new Set(list.map((x) => x.label).filter(Boolean))].join(" · ");
    return dividerHTML(`#${code}`, list.length, { title: labels ? `#${code}: ${labels}` : `#${code}` }) +
      list.map(({ b }) => `<div class="slot">${spineHTML(b, currentRead(b.id))}</div>`).join("");
  }).join("");
  const notes = only && codes.length ? byIdea.get(only).filter((x) => x.label) : [];
  return `<section class="shelf by-idea">
      <h2 class="label"><span>${only ? `Ideia #${esc(only)}` : "Ideias do FilosoX"}</span><small>${only ? byIdea.get(only)?.length || 0 : codes.length}</small></h2>
      ${body ? `<div class="case"><div class="books">${body}</div></div>` : `<p class="hint">Nenhum livro ligado ${only ? `à ideia #${esc(only)}` : "a ideias do FilosoX ainda"}. As conexões ficam em Editar dados.</p>`}
      ${notes.length ? `<ul class="idea-notes">${notes.map(({ b, label }) => `<li><b>${esc(b.title)}</b>: ${esc(label)}</li>`).join("")}</ul>` : ""}
    </section>`;
}

// Only the shelves redraw while typing in the search box, so it keeps focus.
export function fillShelves(view, filter = "") {
  const q = filter.trim().toLowerCase();
  const groups = Object.fromEntries(ORDER.map((s) => [s, []]));
  const shown = [];
  for (const b of S.books) {
    const r = currentRead(b.id);
    const hay = [b.title, ...(b.authors || []), b.genre, ...(b.tags || []), b.connections].join(" ").toLowerCase();
    if (q && !hay.includes(q)) continue;
    groups[r?.status || "quero"].push({ b, r });
    shown.push(b);
  }
  groups.lendo.sort((x, y) => byPriority(x.b, y.b));
  groups.lido.sort((x, y) => (y.r?.end || "").localeCompare(x.r?.end || ""));
  groups.quero.sort((x, y) => byPriority(x.b, y.b));

  const year = new Date().getFullYear();
  const readThisYear = S.reads.filter((r) => r.status === "lido" && (r.end || "").startsWith(year)).length;
  const total = S.books.length;

  const shelf = (status) => {
    const items = groups[status];
    if (status === "abandonado" && !items.length) return "";
    const queue = QUEUES.includes(status) && items.length > 1;
    const spines = items.map(({ b, r }, i) => `<div class="slot">${spineHTML(b, r, { prio: queue && !q ? i + 1 : null })}</div>`).join("");
    const add = q ? "" : `<div class="slot"><button class="spine ghost" type="button" data-add="${status}" aria-label="Novo livro em ${STATUS[status]}">+</button></div>`;
    return `<section class="shelf" data-status="${status}">
      <h2 class="label"><span>${STATUS[status]}</span><small>${items.length}</small>
        ${queue && !q ? `<button type="button" class="reorder-btn" data-reorder="${status}">Ordenar</button>` : ""}</h2>
      ${queue && !q ? `<p class="hint reorder-hint">Arraste os livros (ou use as setas do teclado) para mudar a prioridade. Toque em Pronto ao terminar.</p>` : ""}
      <div class="case"><div class="books">${spines}${add}</div></div>
    </section>`;
  };

  const lendo = S.reads.filter((r) => r.status === "lendo" && currentRead(r.bookId) === r).length;
  view.querySelector(".tally").textContent = total
    ? `${total} ${total === 1 ? "livro" : "livros"} na estante · ${lendo} em leitura · ${readThisYear} ${readThisYear === 1 ? "lido" : "lidos"} em ${year}`
    : "A estante está vazia. Comece pelo primeiro livro.";
  view.querySelector(".shelves").innerHTML =
    mode === "temas" ? themeShelves(shown, q) : mode === "ideias" ? ideaShelves(shown, q) : ORDER.map(shelf).join("");
}

// ---------- reordering a queue ----------
// "Ordenar" turns a shelf into a sortable row: drag a book (mouse or finger) or move it with the
// arrow keys; "Pronto" saves the new order.
export function wireReorder(view) {
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-reorder]");
    if (!btn) return;
    const shelf = btn.closest(".shelf");
    const on = !shelf.classList.contains("reordering");
    view.querySelectorAll(".shelf.reordering").forEach((s) => finish(s));
    if (on) { shelf.classList.add("reordering"); btn.textContent = "Pronto"; }
  });
  view.addEventListener("pointerdown", (e) => {
    const spine = e.target.closest(".reordering .spine[data-id]");
    if (!spine || e.button > 0) return;
    e.preventDefault();
    const slot = spine.parentElement, row = slot.parentElement;
    spine.classList.add("dragging");
    // listen on the document: moving the book in the page drops any pointer capture on it
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const over = [...row.querySelectorAll(".slot")].find((s) => {
        if (s === slot || !s.querySelector(".spine[data-id]")) return false;
        const r = s.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      });
      if (!over) return;
      const r = over.getBoundingClientRect();
      if (ev.clientX > r.left + r.width / 2) over.after(slot);
      else over.before(slot);
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      spine.classList.remove("dragging");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      renumber(row);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });
  view.addEventListener("keydown", (e) => {
    const spine = e.target.closest?.(".reordering .spine[data-id]");
    if (!spine || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const slot = spine.parentElement;
    if (e.key === "ArrowLeft" && slot.previousElementSibling?.querySelector(".spine[data-id]")) slot.previousElementSibling.before(slot);
    if (e.key === "ArrowRight" && slot.nextElementSibling?.querySelector(".spine[data-id]")) slot.nextElementSibling.after(slot);
    spine.focus();
    renumber(slot.parentElement);
  });
}

function renumber(row) {
  row.querySelectorAll(".spine[data-id] .prio").forEach((p, i) => { p.textContent = i + 1; p.title = `Prioridade ${i + 1}`; });
}

function finish(shelf) {
  shelf.classList.remove("reordering");
  shelf.querySelector("[data-reorder]").textContent = "Ordenar";
  saveOrder([...shelf.querySelectorAll(".spine[data-id]")].map((s) => s.dataset.id));
}

// While sorting, a tap must not open the book.
export const isReordering = (el) => !!el.closest(".reordering");
