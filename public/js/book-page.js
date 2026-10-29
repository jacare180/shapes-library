// What is written inside an open book: the record on the left page, the notes on the right.
import { S, write, readsOf, currentRead, notesOf, bookById, criteriaFor, newRead } from "./api.js";
import { esc, rid, today, fmtDate, avg, fmtScore, STATUS, KINDS, NOTE_TYPES, leather } from "./util.js";
import { turnPage } from "./book-open.js";

let ctx = null; // { spread, bookId, onEdit, onClose, onDeleted }

export function fillSpread(spread, bookId, handlers) {
  ctx = { spread, bookId, ...handlers };
  spread.innerHTML = `
    <article class="leaf left" aria-label="Ficha"></article>
    <article class="leaf right" aria-label="Anotações"></article>
    <button class="close-book" type="button" aria-label="Fechar o livro">Fechar</button>
    ${spread.classList.contains("single") ? `<nav class="leaf-tabs"><button type="button" data-leaf="left" class="on">Ficha</button><button type="button" data-leaf="right">Anotações</button></nav>` : ""}`;
  if (spread.classList.contains("single")) spread.querySelector(".leaf.right").hidden = true;
  spread.addEventListener("click", onClick);
  spread.addEventListener("change", onChange);
  drawLeft();
  drawRight();
}

export function clearSpread() { ctx = null; }

// Redraw after a sync from the other device, but never while you are typing.
export function redrawIfIdle() {
  if (!ctx || !ctx.spread.isConnected) return;
  if (ctx.spread.contains(document.activeElement) && document.activeElement.matches("input,textarea,select")) return;
  if (!bookById(ctx.bookId)) return ctx.onClose();
  drawLeft();
  drawRight();
}

const dots = (name, value, max = 5) =>
  `<span class="dots" role="radiogroup" aria-label="${esc(name)}">${Array.from({ length: max }, (_, i) =>
    `<button type="button" role="radio" aria-checked="${value === i + 1}" class="${value > i ? "on" : ""}" data-rate="${esc(name)}" data-v="${i + 1}" aria-label="${i + 1}"></button>`).join("")}</span>`;

const stars = (value) =>
  `<span class="stars" role="radiogroup" aria-label="Nota geral">${[1, 2, 3, 4, 5].map((v) =>
    `<button type="button" role="radio" aria-checked="${value === v}" class="${value >= v ? "on" : ""}" data-overall="${v}" aria-label="${v} de 5">★</button>`).join("")}</span>`;

function drawLeft() {
  const b = bookById(ctx.bookId);
  const r = currentRead(b.id);
  const crit = criteriaFor(b.kind || "ficcao");
  const scores = crit.map((c) => r.ratings?.[c]).filter((v) => v);
  const mean = avg(scores);
  const pct = b.pages ? Math.min(100, Math.round((100 * (r.page || 0)) / b.pages)) : null;
  const past = readsOf(b.id).slice(0, -1).reverse();
  const meta = [b.year, b.pages && `${b.pages} páginas`, b.genre, KINDS[b.kind || "ficcao"]].filter(Boolean).map(esc).join(" · ");

  ctx.spread.querySelector(".leaf.left").innerHTML = `
    <header class="rec-head">
      <div class="thumb" style="--c:${leather(b)}">${b.cover ? `<img src="${esc(b.cover)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</div>
      <div>
        <h1>${esc(b.title)}</h1>
        <p class="by">${esc((b.authors || []).join(", ")) || "Autor desconhecido"}</p>
        <p class="meta">${meta}</p>
        ${(b.tags || []).length ? `<p class="tags">${b.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
      </div>
    </header>

    <div class="status" role="radiogroup" aria-label="Situação">
      ${Object.entries(STATUS).map(([k, v]) => `<button type="button" role="radio" aria-checked="${r.status === k}" class="${r.status === k ? "on" : ""}" data-status="${k}">${v}</button>`).join("")}
    </div>

    <div class="dates">
      <label>Início <input type="date" name="start" value="${esc(r.start || "")}"></label>
      <label>Fim <input type="date" name="end" value="${esc(r.end || "")}"></label>
    </div>

    ${r.status === "lendo" ? `
      <div class="progress">
        <label>Página <input type="number" name="page" min="0" ${b.pages ? `max="${b.pages}"` : ""} value="${r.page || 0}" inputmode="numeric"></label>
        <span>${b.pages ? `de ${b.pages}` : ""}</span>
        ${pct != null ? `<div class="bar" aria-label="${pct}% lido"><i style="width:${pct}%"></i></div><b>${pct}%</b>` : ""}
      </div>` : ""}

    <h2 class="sect">Avaliação</h2>
    <div class="criteria">
      ${crit.map((c) => `<div class="crit"><span>${esc(c)}</span><i></i>${dots(c, r.ratings?.[c] || 0)}</div>`).join("")}
    </div>
    <p class="mean">${mean != null ? `Média dos critérios <b>${fmtScore(mean)}</b>` : "Toque nos pontos para dar notas"}</p>
    <div class="overall"><span>Nota geral</span>${stars(r.overall || 0)}</div>
    <label class="review">Resenha curta<textarea name="review" rows="3" placeholder="O que fica deste livro?">${esc(r.review || "")}</textarea></label>

    ${past.length ? `<h2 class="sect">Leituras anteriores</h2><ul class="past">${past.map((p) =>
      `<li>${esc(STATUS[p.status])}, ${p.start ? fmtDate(p.start) : "?"} a ${p.end ? fmtDate(p.end) : "?"}${p.overall ? ` · ${"★".repeat(p.overall)}` : ""}</li>`).join("")}</ul>` : ""}

    <footer class="rec-foot">
      <button type="button" data-act="edit">Editar dados</button>
      ${["lido", "abandonado"].includes(r.status) ? `<button type="button" data-act="reread">Ler de novo</button>` : ""}
      <button type="button" data-act="remove" class="danger">Tirar da estante</button>
    </footer>`;
}

function drawRight() {
  const b = bookById(ctx.bookId);
  const notes = notesOf(b.id).sort((x, y) => (x.page || 1e9) - (y.page || 1e9) || (x.createdAt || 0) - (y.createdAt || 0));
  ctx.spread.querySelector(".leaf.right").innerHTML = `
    <h2 class="sect first">Anotações <small>${notes.length || ""}</small></h2>
    <form class="note-form" autocomplete="off">
      <div class="note-kind" role="radiogroup" aria-label="Tipo">
        ${Object.entries(NOTE_TYPES).map(([k, v], i) => `<label><input type="radio" name="type" value="${k}" ${i === 0 ? "checked" : ""}><span>${v}</span></label>`).join("")}
      </div>
      <textarea name="text" rows="3" required placeholder="Uma frase, uma ideia, um resumo do capítulo..."></textarea>
      <div class="note-row">
        <label>Página <input type="number" name="page" min="0" inputmode="numeric"></label>
        <button type="submit" class="brass">Guardar</button>
      </div>
    </form>
    <ol class="notes">
      ${notes.map((n) => `
        <li class="note ${esc(n.type)}" data-note="${esc(n.id)}">
          <div class="n-meta"><span>${esc(NOTE_TYPES[n.type] || "")}</span>${n.page ? `<span>p. ${n.page}</span>` : ""}<span>${fmtDate(n.date)}</span></div>
          <p>${esc(n.text).replace(/\n/g, "<br>")}</p>
          <div class="n-act"><button type="button" data-act="del-note">Apagar</button></div>
        </li>`).join("") || `<li class="empty">Nenhuma anotação ainda. As margens estão esperando.</li>`}
    </ol>`;
  ctx.spread.querySelector(".note-form").addEventListener("submit", onNote);
}

async function onNote(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const text = f.get("text").trim();
  if (!text) return;
  const page = parseInt(f.get("page"), 10) || null;
  const type = f.get("type");
  e.target.reset();
  await write("set", `notes/${rid()}`, { bookId: ctx.bookId, type, page, text, date: today(), createdAt: Date.now() }).catch(() => {});
  drawRight();
  ctx.spread.querySelector(`.note-form input[value="${type}"]`).checked = true;
}

const read = () => currentRead(ctx.bookId);
const saveRead = (data) => write("update", `reads/${read().id}`, data).catch(() => {});

async function onClick(e) {
  const t = e.target.closest("button");
  if (!t || !ctx) return;
  const r = read();
  if (t.matches(".close-book")) return ctx.onClose();
  if (t.dataset.leaf) {
    const tabs = ctx.spread.querySelectorAll(".leaf-tabs button");
    if (t.classList.contains("on")) return;
    tabs.forEach((b) => b.classList.toggle("on", b === t));
    const toRight = t.dataset.leaf === "right";
    return turnPage(ctx.spread.querySelector(`.leaf.${toRight ? "left" : "right"}`), ctx.spread.querySelector(`.leaf.${t.dataset.leaf}`), toRight);
  }
  if (t.dataset.status) {
    const status = t.dataset.status;
    const patch = { status };
    if ((status === "lendo" || status === "lido") && !r.start) patch.start = today();
    if (status === "lido" && !r.end) patch.end = today();
    if (status === "lido") { const b = bookById(ctx.bookId); if (b.pages) patch.page = b.pages; }
    await saveRead(patch);
    return drawLeft();
  }
  if (t.dataset.rate) {
    const v = +t.dataset.v;
    const ratings = { ...(r.ratings || {}) };
    ratings[t.dataset.rate] = ratings[t.dataset.rate] === v ? 0 : v; // tap the same dot again to clear
    await saveRead({ ratings });
    return drawLeft();
  }
  if (t.dataset.overall) {
    const v = +t.dataset.overall;
    await saveRead({ overall: r.overall === v ? null : v });
    return drawLeft();
  }
  const act = t.dataset.act;
  if (act === "edit") return ctx.onEdit(ctx.bookId);
  if (act === "reread") {
    await newRead(ctx.bookId, "lendo").catch(() => {});
    return drawLeft();
  }
  if (act === "remove") {
    if (!confirm("Tirar este livro da estante? As leituras e anotações dele somem junto.")) return;
    const id = ctx.bookId;
    await write("update", `books/${id}`, { deleted: true }).catch(() => {});
    S.books = S.books.filter((b) => b.id !== id);
    return ctx.onDeleted();
  }
  if (act === "del-note") {
    const id = t.closest("[data-note]").dataset.note;
    if (!confirm("Apagar esta anotação?")) return;
    await write("delete", `notes/${id}`).catch(() => {});
    return drawRight();
  }
}

async function onChange(e) {
  const t = e.target;
  if (!ctx || t.closest(".note-form")) return;
  if (t.name === "start" || t.name === "end") return saveRead({ [t.name]: t.value });
  if (t.name === "review") return saveRead({ review: t.value.trim() });
  if (t.name === "page") {
    const b = bookById(ctx.bookId);
    const page = Math.max(0, Math.min(b.pages || Infinity, parseInt(t.value, 10) || 0));
    await saveRead({ page });
    return drawLeft();
  }
}
