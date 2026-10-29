// Yearly goal: a shelf that fills up with the books finished that year, with empty places still to fill.
import { S, write, bookById } from "./api.js";
import { esc, MONTHS_SHORT } from "./util.js";
import { spineHTML } from "./shelf.js";

let year = new Date().getFullYear();

function finishedIn(y) {
  return S.reads
    .filter((r) => r.status === "lido" && (r.end || "").startsWith(String(y)) && bookById(r.bookId))
    .sort((a, b) => a.end.localeCompare(b.end));
}

function pace(goal, done, y) {
  const now = new Date();
  const start = new Date(y, 0, 1), end = new Date(y + 1, 0, 1);
  if (now < start) return `O ano ainda não começou.`;
  if (now >= end) return done >= goal ? `Meta cumprida em ${y}.` : `${y} terminou com ${done} de ${goal}.`;
  if (done >= goal) return `Meta cumprida! Cada livro a mais agora é bônus.`;
  const frac = (now - start) / (end - start);
  const expected = goal * frac;
  const diff = Math.round((done - expected) * 10) / 10;
  const left = goal - done;
  const daysLeft = Math.ceil((end - now) / 864e5);
  const every = Math.max(1, Math.round(daysLeft / left));
  const where = Math.abs(diff) < 0.5 ? "Você está no ritmo certo."
    : diff > 0 ? `Você está ${Math.round(diff)} ${Math.round(diff) === 1 ? "livro" : "livros"} à frente do ritmo.`
    : `Você está ${Math.round(-diff)} ${Math.round(-diff) === 1 ? "livro" : "livros"} atrás do ritmo.`;
  return `${where} Faltam ${left} em ${daysLeft} dias: cerca de 1 livro a cada ${every} dias.`;
}

export function renderGoals(view) {
  const g = S.goals[year] || {};
  const done = finishedIn(year);
  const pages = done.reduce((n, r) => n + (bookById(r.bookId).pages || 0), 0);
  const goal = g.books || 0;
  const perMonth = Array(12).fill(0);
  done.forEach((r) => perMonth[+r.end.slice(5, 7) - 1]++);
  const peak = Math.max(1, ...perMonth);
  const ghosts = Math.max(0, goal - done.length);

  view.innerHTML = `
    <section class="goals">
      <div class="year-nav">
        <button type="button" data-year="-1" aria-label="Ano anterior">‹</button>
        <h1>${year}</h1>
        <button type="button" data-year="1" aria-label="Próximo ano">›</button>
      </div>

      <form class="goal-form">
        <label>Meta de livros <input name="books" type="number" min="0" inputmode="numeric" value="${goal || ""}" placeholder="24"></label>
        <label>Meta de páginas <input name="pages" type="number" min="0" step="100" inputmode="numeric" value="${g.pages || ""}" placeholder="opcional"></label>
      </form>

      <div class="goal-numbers">
        <p><b>${done.length}</b>${goal ? ` de ${goal}` : ""} ${done.length === 1 ? "livro lido" : "livros lidos"}</p>
        <p><b>${pages.toLocaleString("pt-BR")}</b>${g.pages ? ` de ${g.pages.toLocaleString("pt-BR")}` : ""} páginas</p>
      </div>
      ${goal ? `<div class="bar big" aria-label="${Math.round((100 * done.length) / goal)}% da meta"><i style="width:${Math.min(100, (100 * done.length) / goal)}%"></i></div>
        <p class="pace">${pace(goal, done.length, year)}</p>` : `<p class="pace">Defina uma meta para ver o ritmo de leitura.</p>`}

      <h2 class="label"><span>Estante de ${year}</span></h2>
      <div class="case"><div class="books">
        ${done.map((r) => `<div class="slot">${spineHTML(bookById(r.bookId), r)}</div>`).join("")}
        ${Array.from({ length: Math.min(ghosts, 60) }, () => `<div class="slot"><span class="spine empty-place" aria-hidden="true"></span></div>`).join("")}
      </div></div>

      <h2 class="label"><span>Mês a mês</span></h2>
      <div class="months">
        ${perMonth.map((n, i) => `<div class="m"><i style="height:${(100 * n) / peak}%"></i><b>${n || ""}</b><span>${MONTHS_SHORT[i]}</span></div>`).join("")}
      </div>
    </section>`;

  view.querySelectorAll("[data-year]").forEach((b) => (b.onclick = () => { year += +b.dataset.year; renderGoals(view); }));
  view.querySelector(".goal-form").onchange = async (e) => {
    const f = new FormData(e.currentTarget);
    await write("set", `goals/${year}`, { books: parseInt(f.get("books"), 10) || 0, pages: parseInt(f.get("pages"), 10) || 0 }).catch(() => {});
    renderGoals(view);
  };
}
