// Settings: rating criteria per kind of book, theme colours, backup and import, leaving this device.
import { S, write, setKey, importLibrary } from "./api.js";
import { esc, KINDS, today, toast, LEATHER, THEME_DEFAULTS, MODERN, MODERN_THEME_DEFAULTS, themeColor, look, applyLook } from "./util.js";

const swatches = () => (look() === "moderno"
  ? [...new Set([...Object.values(MODERN_THEME_DEFAULTS), ...MODERN])]
  : [...new Set([...Object.values(THEME_DEFAULTS), ...LEATHER])]);

export function renderSettings(view) {
  const crit = S.config.criteria || {};
  const themes = [...new Set(S.books.flatMap((b) => b.tags || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  view.innerHTML = `
    <section class="settings">
      <h1>Ajustes</h1>

      <h2 class="label"><span>Visual</span></h2>
      <p class="hint">Vale para todos os seus aparelhos. Seus livros e anotações não mudam.</p>
      <div class="look-switch" role="radiogroup" aria-label="Visual">
        <button type="button" role="radio" data-look="classico" aria-checked="${look() === "classico"}">Clássico</button>
        <button type="button" role="radio" data-look="moderno" aria-checked="${look() === "moderno"}">Moderno</button>
      </div>

      <h2 class="label"><span>Critérios de avaliação</span></h2>
      <p class="hint">Um critério por linha. Cada livro usa a lista do seu tipo, e as notas antigas continuam guardadas.</p>
      <form class="crit-form">
        ${Object.entries(KINDS).map(([k, v]) => `<label>${v}<textarea name="${k}" rows="6">${esc((crit[k] || []).join("\n"))}</textarea></label>`).join("")}
        <div class="actions"><button class="brass" type="submit">Salvar critérios</button></div>
      </form>

      <h2 class="label"><span>Cores dos temas</span></h2>
      <p class="hint">A lombada de cada livro usa a cor do seu primeiro tema, a menos que você escolha outra cor no próprio livro. Cada visual tem as suas cores.</p>
      ${themes.length ? `<div class="theme-colors">${themes.map((t) => `
        <fieldset class="theme-row" data-theme="${esc(t)}"><legend><span class="dot" style="--c:${themeColor(t)}"></span>${esc(t)}</legend>
          <div class="swatches">${swatches().map((c) => `<label><input type="radio" name="tc-${esc(t)}" value="${c}" ${themeColor(t) === c ? "checked" : ""}><span style="--c:${c}"></span></label>`).join("")}</div>
        </fieldset>`).join("")}</div>` : `<p class="hint">Nenhum livro tem tema ainda.</p>`}

      <h2 class="label"><span>Cópia de segurança</span></h2>
      <p class="hint">Baixa um arquivo com todos os livros, leituras, anotações e metas.</p>
      <button type="button" class="brass" data-act="backup">Baixar cópia (JSON)</button>

      <h2 class="label"><span>Importar</span></h2>
      <p class="hint">Traz livros de uma cópia de segurança ou de um arquivo preparado. Os livros que já estão na estante continuam; importar o mesmo arquivo de novo não duplica nada.</p>
      <label class="brass file-btn">Escolher arquivo (JSON)<input type="file" accept=".json,application/json" data-act="import" hidden></label>
      <p class="hint import-msg" aria-live="polite"></p>

      <h2 class="label"><span>Este aparelho</span></h2>
      <p class="hint">A chave da biblioteca fica guardada aqui. Para entrar em outro aparelho, abra o link com a chave nele.</p>
      <button type="button" data-act="leave">Sair deste aparelho</button>
    </section>`;

  view.querySelector(".crit-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const lists = Object.fromEntries(Object.keys(KINDS).map((k) => [k, [...new Set(f.get(k).split("\n").map((s) => s.trim()).filter(Boolean))]]));
    await write("set", "config/criteria", lists).then(() => toast("Critérios salvos.")).catch(() => {});
  };
  view.querySelector(".theme-colors")?.addEventListener("change", async (e) => {
    const row = e.target.closest("[data-theme]");
    if (!row) return;
    row.querySelector(".dot").style.setProperty("--c", e.target.value);
    const key = look() === "moderno" ? "themeColorsModern" : "themeColors";
    const colors = { ...(S.config[key] || {}), [row.dataset.theme]: e.target.value };
    await write("set", `config/${key}`, colors).catch(() => {}); // the swatch and the dot already show it
  });
  view.querySelector(".look-switch").onclick = async (e) => {
    const b = e.target.closest("[data-look]");
    if (!b || b.dataset.look === look()) return;
    applyLook(b.dataset.look);
    renderSettings(view);
    await write("set", "config/ui", { ...(S.config.ui || {}), look: b.dataset.look }).catch(() => {});
  };
  view.querySelector('[data-act="backup"]').onclick = () => {
    const { books, reads, notes, goals, config } = S;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), books, reads, notes, goals, config }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `shapex-library-${today()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  view.querySelector('[data-act="import"]').onchange = async (e) => {
    const f = e.target.files[0];
    const msg = view.querySelector(".import-msg");
    if (!f) return;
    msg.textContent = "Importando…";
    try {
      const n = await importLibrary(JSON.parse(await f.text()));
      msg.textContent = `${n} ${n === 1 ? "livro importado" : "livros importados"}. Eles já estão na estante.`;
    } catch {
      msg.textContent = "Não consegui importar este arquivo. Confira se é uma cópia da ShapeX Library.";
    }
    e.target.value = "";
  };
  view.querySelector('[data-act="leave"]').onclick = () => {
    if (!confirm("Sair deste aparelho? Seus livros continuam salvos na biblioteca.")) return;
    setKey("");
    try { localStorage.removeItem("shapes-cache"); } catch {}
    location.replace("/");
  };
}
