// Settings: rating criteria per kind of book, a backup copy, leaving this device.
import { S, write, setKey } from "./api.js";
import { esc, KINDS, today, toast } from "./util.js";

export function renderSettings(view) {
  const crit = S.config.criteria || {};
  view.innerHTML = `
    <section class="settings">
      <h1>Ajustes</h1>

      <h2 class="label"><span>Critérios de avaliação</span></h2>
      <p class="hint">Um critério por linha. Cada livro usa a lista do seu tipo, e as notas antigas continuam guardadas.</p>
      <form class="crit-form">
        ${Object.entries(KINDS).map(([k, v]) => `<label>${v}<textarea name="${k}" rows="6">${esc((crit[k] || []).join("\n"))}</textarea></label>`).join("")}
        <div class="actions"><button class="brass" type="submit">Salvar critérios</button></div>
      </form>

      <h2 class="label"><span>Cópia de segurança</span></h2>
      <p class="hint">Baixa um arquivo com todos os livros, leituras, anotações e metas.</p>
      <button type="button" class="brass" data-act="backup">Baixar cópia (JSON)</button>

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
  view.querySelector('[data-act="backup"]').onclick = () => {
    const { books, reads, notes, goals, config } = S;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), books, reads, notes, goals, config }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `shapes-library-${today()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  view.querySelector('[data-act="leave"]').onclick = () => {
    if (!confirm("Sair deste aparelho? Seus livros continuam salvos na biblioteca.")) return;
    setKey("");
    try { localStorage.removeItem("shapes-cache"); } catch {}
    location.replace("/");
  };
}
