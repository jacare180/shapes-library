// Adding a book (search the catalogs or fill in by hand) and editing its details.
import { S, search, addBook, write, bookById } from "./api.js";
import { esc, LEATHER, leather, STATUS, KINDS, toast } from "./util.js";

const modal = () => document.getElementById("modal");

const FICTION = /fic|romance|novel|conto|poe|fantas|science fiction|thriller|mystery|drama|literat/i;
const guessKind = (genre) => (/non-?fiction|não.?fic/i.test(genre) ? "nao-ficcao" : FICTION.test(genre || "") ? "ficcao" : "nao-ficcao");

function formHTML(b = {}, { status } = {}) {
  const color = b.color || "";
  return `
    <label class="wide">Título <input name="title" required value="${esc(b.title || "")}"></label>
    <label class="wide">Autor(es) <input name="authors" placeholder="Separe com vírgula" value="${esc((b.authors || []).join(", "))}"></label>
    <label>Ano <input name="year" type="number" inputmode="numeric" value="${esc(b.year || "")}"></label>
    <label>Páginas <input name="pages" type="number" min="1" inputmode="numeric" value="${esc(b.pages || "")}"></label>
    <label>Gênero <input name="genre" value="${esc(b.genre || "")}"></label>
    <fieldset class="kind"><legend>Tipo</legend>
      ${Object.entries(KINDS).map(([k, v]) => `<label><input type="radio" name="kind" value="${k}" ${(b.kind || "ficcao") === k ? "checked" : ""}><span>${v}</span></label>`).join("")}
    </fieldset>
    <label class="wide">Tags <input name="tags" placeholder="clube do livro, presente, kindle..." value="${esc((b.tags || []).join(", "))}"></label>
    <label class="wide">Capa (endereço da imagem) <input name="cover" type="url" value="${esc(b.cover || "")}"></label>
    <fieldset class="wide swatches"><legend>Cor da lombada</legend>
      <label><input type="radio" name="color" value="" ${!color ? "checked" : ""}><span class="auto" title="Automática">auto</span></label>
      ${LEATHER.map((c) => `<label><input type="radio" name="color" value="${c}" ${color === c ? "checked" : ""}><span style="--c:${c}"></span></label>`).join("")}
    </fieldset>
    ${status ? `<label class="wide">Em qual prateleira?
      <select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === status ? "selected" : ""}>${v}</option>`).join("")}</select></label>` : ""}`;
}

function readForm(form) {
  const f = new FormData(form);
  const list = (k) => f.get(k).split(",").map((s) => s.trim()).filter(Boolean);
  return {
    title: f.get("title").trim(),
    authors: list("authors"),
    year: parseInt(f.get("year"), 10) || null,
    pages: parseInt(f.get("pages"), 10) || null,
    genre: f.get("genre").trim(),
    kind: f.get("kind") || "ficcao",
    tags: list("tags"),
    cover: f.get("cover").trim(),
    color: f.get("color") || "",
  };
}

function open(html) {
  const m = modal();
  m.innerHTML = `<div class="card">${html}<button class="x" type="button" aria-label="Fechar">×</button></div>`;
  m.querySelector(".x").onclick = () => m.close();
  m.onclick = (e) => { if (e.target === m) m.close(); };
  m.showModal();
  return m;
}

export function newBookDialog(status = "quero", onAdded) {
  const m = open(`
    <h2>Novo livro</h2>
    <form class="finder" role="search">
      <input name="q" type="search" placeholder="Título, autor ou ISBN" autofocus>
      <button class="brass" type="submit">Procurar</button>
    </form>
    <div class="results" aria-live="polite"></div>
    <details class="manual">
      <summary>Preencher à mão</summary>
      <form class="book-form">${formHTML({}, { status })}<div class="actions"><button class="brass" type="submit">Pôr na estante</button></div></form>
    </details>`);
  const results = m.querySelector(".results");
  const form = m.querySelector(".book-form");
  const details = m.querySelector(".manual");
  let found = [];

  m.querySelector(".finder").onsubmit = async (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (!q) return;
    results.innerHTML = `<p class="hint">Procurando nos catálogos...</p>`;
    try {
      const d = await search(q);
      found = d.results;
      results.innerHTML = found.length
        ? `<ul>${found.map((b, i) => `
            <li><button type="button" data-i="${i}">
              <span class="mini" style="--c:${leather({ id: b.title, title: b.title })}">${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>
              <span><b>${esc(b.title)}</b><br>${esc(b.authors.join(", "))}<small>${[b.year, b.pages && b.pages + " p."].filter(Boolean).join(" · ")}</small></span>
            </button></li>`).join("")}</ul>
            ${d.failed?.length ? `<p class="hint">Sem resposta de ${d.failed.join(" e ")}.</p>` : ""}`
        : `<p class="hint">Nada encontrado${d.failed?.length ? ` (sem resposta de ${d.failed.join(" e ")})` : ""}. Tente outro termo ou preencha à mão.</p>`;
    } catch {
      results.innerHTML = `<p class="hint">A busca falhou. Confira a conexão ou preencha à mão.</p>`;
    }
  };

  results.onclick = (e) => {
    const btn = e.target.closest("[data-i]");
    if (!btn) return;
    const b = found[+btn.dataset.i];
    const st = form.elements.status.value;
    form.innerHTML = `${formHTML({ ...b, kind: guessKind(b.genre) }, { status: st })}<div class="actions"><button class="brass" type="submit">Pôr na estante</button></div>`;
    details.open = true;
    details.querySelector("summary").textContent = "Confira os dados";
    form.elements.title.focus();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const book = readForm(form);
    if (!book.title) return;
    const status = form.elements.status.value;
    m.close();
    try {
      const id = await addBook(book, status);
      toast(`"${book.title}" está na estante.`);
      onAdded?.(id);
    } catch { /* toast already shown */ }
  };
}

export function editBookDialog(bookId, onSaved) {
  const b = bookById(bookId);
  const m = open(`
    <h2>Editar dados</h2>
    <form class="book-form">${formHTML(b)}<div class="actions"><button class="brass" type="submit">Salvar</button></div></form>`);
  m.querySelector(".book-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = readForm(e.target);
    if (!data.title) return;
    m.close();
    await write("update", `books/${bookId}`, data).catch(() => {});
    onSaved?.();
  };
}

export const hasBooks = () => S.books.length > 0;
