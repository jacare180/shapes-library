import { S, getKey, setKey, takeKeyFromUrl, loadCache, refresh, bookById, currentRead, newRead, write } from "./api.js";
import { $, $$, esc, toast } from "./util.js";
import { renderShelves, fillShelves } from "./shelf.js";
import { openBook, closeBook } from "./book-open.js";
import { fillSpread, clearSpread, redrawIfIdle } from "./book-page.js";
import { newBookDialog, editBookDialog, catalogDialog } from "./forms.js";
import { renderGoals } from "./goals.js";
import { renderSettings } from "./settings.js";

const view = $("#view");
const layer = $("#book-layer");
let filter = "";
let openId = null;
let busy = false;

// ---------- the door: asks for the library key once per device ----------
function door(msg = "") {
  $(".top").hidden = true;
  view.innerHTML = `
    <section class="door">
      <div class="door-plaque">
        <p class="small">Biblioteca particular</p>
        <h1>Shapes Library</h1>
        <form>
          <label>Chave <input name="k" type="password" autocomplete="current-password" required autofocus></label>
          <button class="brass" type="submit">Entrar</button>
        </form>
        ${msg ? `<p class="door-msg">${esc(msg)}</p>` : ""}
      </div>
    </section>`;
  $("form", view).onsubmit = (e) => {
    e.preventDefault();
    setKey(e.target.k.value.trim());
    start();
  };
}

async function start() {
  if (!getKey()) return door();
  loadCache();
  try {
    await refresh();
  } catch (e) {
    if (e.status === 401) { setKey(""); return door("Essa chave não abre esta biblioteca."); }
    if (e.status === 503) return door("A biblioteca ainda não tem chave configurada no servidor (KEY_OWNER).");
    if (!S.loaded) return door("Não consegui falar com a biblioteca. Confira a conexão.");
    toast("Sem conexão: mostrando a última cópia salva.", "bad");
  }
  $(".top").hidden = false;
  route();
}

// ---------- routes: #/  #/livro/<id>  #/metas  #/ajustes ----------
function route() {
  const [, page = "", id] = location.hash.split("/");
  $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === (page === "livro" || !page ? "estante" : page)));
  if (page === "metas") { shut(); return renderGoals(view); }
  if (page === "ajustes") { shut(); return renderSettings(view); }
  if (!$(".shelves", view)) renderShelves(view, filter);
  else fillShelves(view, filter);
  if (page === "livro" && id) show(decodeURIComponent(id));
  else shut();
}

async function show(id) {
  if (openId === id || busy) return;
  const book = bookById(id);
  if (!book) { location.hash = "#/"; return; }
  busy = true;
  openId = id;
  if (!currentRead(id)) await newRead(id).catch(() => {});
  document.body.classList.add("reading");
  await openBook(layer, book, spineOf(id), (spread) => fillSpread(spread, id, {
    onClose: () => { location.hash = "#/"; },
    onEdit: (bid) => editBookDialog(bid, () => { redrawIfIdle(); fillShelves(view, filter); }),
    onCatalog: (bid) => catalogDialog(bid, async (data) => {
      // a % typed before the page count was known becomes a page now
      const r = currentRead(bid);
      if (data.pages && r?.pct && !(r.page > 0)) await write("update", `reads/${r.id}`, { page: Math.round((r.pct * data.pages) / 100) }).catch(() => {});
      redrawIfIdle(); fillShelves(view, filter);
    }),
    onDeleted: () => { toast("Livro retirado da estante."); location.hash = "#/"; },
  }));
  busy = false;
  // the address changed while the book was opening (Esc, back button): follow it now
  if (location.hash !== `#/livro/${encodeURIComponent(id)}`) route();
}

async function shut() {
  if (!openId || busy) return;
  busy = true;
  clearSpread();
  const id = openId;
  openId = null;
  if ($(".shelves", view)) fillShelves(view, filter);
  const spine = spineOf(id);
  if (spine) spine.classList.add("out");
  await closeBook(layer, spine);
  document.body.classList.remove("reading");
  busy = false;
  if (location.hash.startsWith("#/livro/")) route(); // another book was asked for while this one closed
}

const spineOf = (id) => view.querySelector(`.spine[data-id="${CSS.escape(id)}"]`);

// ---------- events ----------
view.addEventListener("click", (e) => {
  const spine = e.target.closest(".spine[data-id]");
  if (spine && !e.target.closest(".goals")) { location.hash = `#/livro/${encodeURIComponent(spine.dataset.id)}`; return; }
  const add = e.target.closest("[data-add]");
  if (add) newBookDialog(add.dataset.add, () => fillShelves(view, filter));
});
view.addEventListener("input", (e) => {
  if (!e.target.matches(".find")) return;
  filter = e.target.value;
  fillShelves(view, filter);
});
layer.addEventListener("click", (e) => { if (e.target.matches(".dim, .stage")) location.hash = "#/"; });
addEventListener("keydown", (e) => { if (e.key === "Escape" && openId && !$("#modal").open) location.hash = "#/"; });
$("#add-book").onclick = () => newBookDialog("quero", () => { if ($(".shelves", view)) fillShelves(view, filter); });
addEventListener("hashchange", route);

// Coming back to the app (or to the tab) picks up what was changed on the other device.
let last = 0;
async function resync() {
  if (!getKey() || Date.now() - last < 10_000) return;
  last = Date.now();
  try {
    await refresh();
    if ($(".shelves", view)) fillShelves(view, filter);
    redrawIfIdle();
  } catch { /* offline: keep the copy on screen */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resync(); });
addEventListener("focus", resync);

takeKeyFromUrl();
start();
