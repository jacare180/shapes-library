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
    <label class="wide">Temas <input name="tags" placeholder="Separe com vírgula: Filosofia política, Judaísmo, IA..." value="${esc((b.tags || []).join(", "))}"></label>
    <label class="wide">Por que ler <textarea name="why" rows="3" placeholder="O que este livro tem para você">${esc(b.why || "")}</textarea></label>
    <label class="wide">Conexões com o FilosoX <textarea name="connections" rows="2" placeholder="#019 (tradição como linhagem de textos), #026">${esc(b.connections || "")}</textarea>
      <small class="field-hint">Escreva as ideias como #019; o texto entre parênteses vira a descrição.</small></label>
    <label class="wide">Capa (endereço da imagem) <input name="cover" type="url" value="${esc(b.cover || "")}"></label>
    <fieldset class="wide swatches"><legend>Cor da lombada</legend>
      <label><input type="radio" name="color" value="" ${!color ? "checked" : ""}><span class="auto" title="Cor do primeiro tema">do tema</span></label>
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
    why: f.get("why").trim(),
    connections: f.get("connections").trim(),
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

// Searches both catalogs and lists what came back; returns the results so a click can pick one.
async function runSearch(q, box, fallback) {
  box.innerHTML = `<p class="hint">Procurando nos catálogos...</p>`;
  try {
    const d = await search(q);
    const silent = d.failed?.length ? `sem resposta de ${d.failed.map((f) => `${f.name} (${f.reason})`).join(" e ")}` : "";
    box.innerHTML = d.results.length
      ? `<ul>${d.results.map((b, i) => `
          <li><button type="button" data-i="${i}">
            <span class="mini" style="--c:${leather({ id: b.title, title: b.title })}">${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>
            <span><b>${esc(b.title)}</b><br>${esc(b.authors.join(", "))}<small>${[b.year, b.pages && b.pages + " p.", b.source].filter(Boolean).map(esc).join(" · ")}</small></span>
          </button></li>`).join("")}</ul>
          ${silent ? `<p class="hint">${silent[0].toUpperCase() + silent.slice(1)}.</p>` : ""}`
      : `<p class="hint">Nada encontrado${silent ? ` (${silent})` : ""}. Tente o título original, só o sobrenome do autor, o ISBN ${fallback}.</p>`;
    return d.results;
  } catch {
    box.innerHTML = `<p class="hint">A busca falhou. Confira a conexão ${fallback}.</p>`;
    return [];
  }
}

const FILL = [
  ["cover", "Capa", (v) => `<span class="mini"><img src="${esc(v)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"></span>`],
  ["pages", "Páginas", (v) => esc(v)],
  ["year", "Ano", (v) => esc(v)],
  ["isbn", "ISBN", (v) => esc(v)],
];

// Fills an existing book (imported, typed by hand) from the catalogs. Empty fields come checked;
// a field that already has a value is only replaced if you tick it.
export function catalogDialog(bookId, onSaved) {
  const b = bookById(bookId);
  const m = open(`
    <h2>Completar pelo catálogo</h2>
    <form class="finder" role="search">
      <input name="q" type="search" value="${esc([b.title, (b.authors || [])[0]].filter(Boolean).join(" "))}" aria-label="Procurar no catálogo">
      <button class="brass" type="submit">Procurar</button>
    </form>
    <div class="results" aria-live="polite"></div>
    <form class="fill" hidden></form>`);
  const results = m.querySelector(".results");
  const fill = m.querySelector(".fill");
  let found = [];
  const go = async (q) => { fill.hidden = true; found = await runSearch(q, results, "ou corrija o título acima"); };
  m.querySelector(".finder").onsubmit = (e) => { e.preventDefault(); go(e.target.q.value.trim()); };
  go(m.querySelector(".finder").q.value);

  results.onclick = (e) => {
    const btn = e.target.closest("[data-i]");
    if (!btn) return;
    const c = found[+btn.dataset.i];
    const rows = FILL.filter(([k]) => c[k]);
    results.querySelectorAll("[data-i]").forEach((x) => x.classList.toggle("on", x === btn));
    fill.hidden = false;
    fill.innerHTML = rows.length ? `
      <p class="hint">Do ${esc(c.source)}: marque o que trazer.</p>
      ${rows.map(([k, label, show]) => `
        <label class="fill-row"><input type="checkbox" name="${k}" ${b[k] ? "" : "checked"}>
          <span class="f-label">${label}</span><span class="f-new">${show(c[k])}</span>
          <small>${b[k] ? (k === "cover" ? "troca a capa atual" : `hoje: ${esc(b[k])}`) : "vazio hoje"}</small></label>`).join("")}
      <div class="actions"><button class="brass" type="submit">Completar</button></div>`
      : `<p class="hint">Este resultado não traz capa, páginas, ano nem ISBN. Escolha outro.</p>`;
    fill.onsubmit = async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(rows.filter(([k]) => fill.elements[k].checked).map(([k]) => [k, c[k]]));
      if (!Object.keys(data).length) return m.close();
      m.close();
      await write("update", `books/${bookId}`, data).catch(() => {});
      onSaved?.(data);
      toast("Dados completados pelo catálogo.");
    };
    fill.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
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
    found = await runSearch(q, results, "ou preencha à mão");
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
    if (data.why !== (b.why || "")) data.whyBy = "eu"; // rewriting it makes it yours
    m.close();
    await write("update", `books/${bookId}`, data).catch(() => {});
    onSaved?.();
  };
}

export const hasBooks = () => S.books.length > 0;
