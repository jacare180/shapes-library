// Opening a book: it slides off the shelf, turns to show its cover, then the cover swings open on the spine.
// The book is a 3D box (covers, spine, page edges) built with CSS transforms. Its transform origin sits
// on the spine, so on the shelf it starts exactly over the spine you clicked and the open spread ends
// with the spine in the middle of the screen.
import { esc, leather, reducedMotion } from "./util.js";

const EASE = "cubic-bezier(.4,.1,.2,1)";

export function pageSize() {
  const vw = innerWidth, vh = innerHeight;
  const single = vw < 760;
  if (single) {
    const W = Math.min(vw - 20, 480);
    return { single, W, H: Math.min(vh - 128, Math.round(W * 1.6)) }; // room for Fechar above and the page tabs below
  }
  const H = Math.min(720, vh - 96);
  return { single, W: Math.round(Math.min(H * 0.74, (vw - 64) / 2)), H };
}

function coverHTML(book) {
  const authors = (book.authors || []).join(", ");
  const art = book.cover ? `<img src="${esc(book.cover)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
  return `<div class="leather-cover">
      <div class="frame"><span class="c-title">${esc(book.title)}</span><span class="c-rule"></span><span class="c-author">${esc(authors)}</span></div>
      ${art}
    </div>`;
}

function buildBook(book, W, H, D) {
  const el = document.createElement("div");
  el.className = "bk";
  el.style.cssText = `--W:${W}px;--H:${H}px;--D:${D}px;--c:${leather(book)}`;
  el.innerHTML = `
    <div class="f f-back"></div>
    <div class="f f-page"><div class="paper"></div></div>
    <div class="f f-edge-r"></div><div class="f f-edge-t"></div><div class="f f-edge-b"></div>
    <div class="f f-spine"><span class="band"></span><span class="s-title">${esc(book.title)}</span><span class="band"></span></div>
    <div class="f f-front">
      <div class="out">${coverHTML(book)}</div>
      <div class="in"><div class="paper endpaper"><span class="exlibris">Ex libris<br><b>Shapes Library</b></span></div></div>
    </div>`;
  return el;
}

const tf = (x, y, z, s, ry) => `translate3d(${x}px,${y}px,${z}px) scale3d(${s},${s},${s}) rotateY(${ry}deg)`;
const run = (el, frames, opts) => el.animate(frames, { fill: "forwards", easing: EASE, ...opts }).finished;

// fill(spread) writes the pages; they fade in over the 3D book once it lies open.
export async function openBook(layer, book, spineEl, fill) {
  const { single, W, H } = pageSize();
  const cx = innerWidth / 2, cy = innerHeight / 2 + (single ? 0 : 20);
  const r = spineEl?.getBoundingClientRect();
  const fromShelf = r && r.width > 0 && !reducedMotion();
  const s = fromShelf ? r.height / H : 1;
  const D = fromShelf ? r.width / s : 50;

  layer.innerHTML = `<div class="dim"></div><div class="stage"></div>`;
  layer.hidden = false;
  const stage = layer.querySelector(".stage");
  const bk = buildBook(book, W, H, D);
  const front = bk.querySelector(".f-front");
  stage.append(bk);

  const restX = single ? cx - W / 2 : cx; // where the spine rests once open
  const top = cy - H / 2;
  const opened = `translateZ(${D / 2}px) rotateY(-180deg)`;
  const shut = `translateZ(${D / 2}px) rotateY(0deg)`;

  layer.querySelector(".dim").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" });

  if (!fromShelf) {
    bk.style.transform = tf(restX, top, 0, 1, 0);
    front.style.transform = opened;
    await run(bk, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  } else {
    if (spineEl) spineEl.classList.add("out");
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2 - H / 2; // transform origin is mid-spine
    front.style.transform = shut;
    await run(bk, [
      { transform: tf(sx, sy, 0, s, 90) },
      { transform: tf(sx, sy - 14, 90, s, 90), offset: 0.22 },
      { transform: tf(cx - W / 2, top, 0, 1, 0) },
    ], { duration: 900 });
    await Promise.all([
      run(front, [{ transform: shut }, { transform: opened }], { duration: 950 }),
      run(bk, [{ transform: tf(cx - W / 2, top, 0, 1, 0) }, { transform: tf(restX, top, 0, 1, 0) }], { duration: 950 }),
    ]);
  }

  const spread = document.createElement("div");
  spread.className = `spread${single ? " single" : ""}`;
  spread.style.cssText = `--W:${W}px;--H:${H}px;--c:${leather(book)};left:${single ? restX : restX - W}px;top:${top}px`;
  layer.append(spread);
  layer.bookAnim = { bk, front, W, H, restX, top, opened, shut };
  fill(spread);
  await run(spread, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  bk.style.visibility = "hidden";
}

// The reverse: the cover closes, the book turns and slides back into its gap on the shelf.
export async function closeBook(layer, spineEl) {
  const a = layer.bookAnim;
  if (!a) { layer.hidden = true; layer.innerHTML = ""; return; }
  layer.bookAnim = null;
  const spread = layer.querySelector(".spread");
  const { bk, front, W, H, restX, top, opened, shut } = a;
  const { innerWidth: vw } = window;
  bk.style.visibility = "";
  bk.getAnimations().forEach((x) => x.cancel());
  front.getAnimations().forEach((x) => x.cancel());
  bk.style.transform = tf(restX, top, 0, 1, 0);
  front.style.transform = opened;
  const dim = layer.querySelector(".dim");
  await run(spread, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 });
  spread.remove();

  const r = spineEl?.getBoundingClientRect();
  const onScreen = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && !reducedMotion();
  if (onScreen) {
    const s = r.height / H;
    const cx = vw / 2;
    await Promise.all([
      run(front, [{ transform: opened }, { transform: shut }], { duration: 800 }),
      run(bk, [{ transform: tf(restX, top, 0, 1, 0) }, { transform: tf(cx - W / 2, top, 0, 1, 0) }], { duration: 800 }),
    ]);
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2 - H / 2; // transform origin is mid-spine
    dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: "forwards" });
    await run(bk, [
      { transform: tf(cx - W / 2, top, 0, 1, 0) },
      { transform: tf(sx, sy - 14, 90, s, 90), offset: 0.78 },
      { transform: tf(sx, sy, 0, s, 90) },
    ], { duration: 800 });
  } else {
    dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
    await run(bk, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
  }
  if (spineEl) spineEl.classList.remove("out");
  layer.hidden = true;
  layer.innerHTML = "";
}

// Mobile: one page at a time; switching pages turns the leaf.
export async function turnPage(leafOut, leafIn, forward) {
  if (reducedMotion()) { leafOut.hidden = true; leafIn.hidden = false; return; }
  const k = forward ? -1 : 1;
  await leafOut.animate([{ transform: "rotateY(0deg)", opacity: 1 }, { transform: `rotateY(${k * 90}deg)`, opacity: 0.6 }],
    { duration: 260, easing: "ease-in", fill: "forwards" }).finished;
  leafOut.hidden = true;
  leafOut.getAnimations().forEach((x) => x.cancel());
  leafIn.hidden = false;
  await leafIn.animate([{ transform: `rotateY(${-k * 90}deg)`, opacity: 0.6 }, { transform: "rotateY(0deg)", opacity: 1 }],
    { duration: 260, easing: "ease-out" }).finished;
}
