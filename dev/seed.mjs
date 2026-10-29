// Fills a local library with sample books, through the API, to try the app.
//   node dev/seed.mjs [http://localhost:8787] [key]
const [base = "http://localhost:8787", key = "teste"] = process.argv.slice(2);
const y = new Date().getFullYear();
let n = 0;
const id = () => `seed${(n++).toString(36)}`;
const put = (path, data) =>
  fetch(`${base}/api/write`, { method: "POST", headers: { "content-type": "application/json", "x-library-key": key }, body: JSON.stringify({ op: "set", path, data }) })
    .then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); });

const BOOKS = [
  ["Dom Casmurro", "Machado de Assis", 256, "ficcao", "lido", `${y}-02-10`, `${y}-03-02`, 5, { Escrita: 5, Enredo: 4, Personagens: 5, Ritmo: 4, "Impacto emocional": 4, "Vontade de reler": 5 }],
  ["Grande Sertão: Veredas", "João Guimarães Rosa", 624, "ficcao", "lendo", `${y}-09-20`, "", null, {}, 212],
  ["Sapiens", "Yuval Noah Harari", 464, "nao-ficcao", "lido", `${y}-01-03`, `${y}-01-29`, 4, { Clareza: 5, Profundidade: 3, Aplicabilidade: 3, Originalidade: 4, "Vontade de reler": 3 }],
  ["A Hora da Estrela", "Clarice Lispector", 88, "ficcao", "lido", `${y}-04-11`, `${y}-04-14`, 5, { Escrita: 5, Enredo: 4, Personagens: 5, Ritmo: 5, "Impacto emocional": 5, "Vontade de reler": 4 }],
  ["Cem Anos de Solidão", "Gabriel García Márquez", 448, "ficcao", "lido", `${y}-05-01`, `${y}-06-12`, 5, {}],
  ["Rápido e Devagar", "Daniel Kahneman", 608, "nao-ficcao", "lendo", `${y}-10-02`, "", null, {}, 140],
  ["O Nome da Rosa", "Umberto Eco", 560, "ficcao", "quero"],
  ["Hábitos Atômicos", "James Clear", 320, "nao-ficcao", "lido", `${y}-07-02`, `${y}-07-20`, 3, { Clareza: 5, Profundidade: 2, Aplicabilidade: 5, Originalidade: 2, "Vontade de reler": 2 }],
  ["1984", "George Orwell", 416, "ficcao", "lido", `${y}-08-05`, `${y}-08-25`, 4, {}],
  ["Os Olhos da Pele", "Juhani Pallasmaa", 128, "nao-ficcao", "quero"],
  ["O Pequeno Príncipe", "Antoine de Saint-Exupéry", 96, "ficcao", "lido", `${y - 1}-12-01`, `${y - 1}-12-03`, 4, {}],
  ["Memórias Póstumas de Brás Cubas", "Machado de Assis", 240, "ficcao", "quero"],
  ["Ensaio sobre a Cegueira", "José Saramago", 312, "ficcao", "abandonado", `${y}-03-10`, "", null, {}],
  ["Torto Arado", "Itamar Vieira Junior", 264, "ficcao", "quero"],
];

const t0 = Date.now();
for (const [i, [title, author, pages, kind, status, start = "", end = "", overall = null, ratings = {}, page = 0]] of BOOKS.entries()) {
  const b = id();
  await put(`books/${b}`, { title, authors: [author], pages, kind, year: null, genre: "", tags: [], cover: "", color: "", createdAt: t0 - i * 1000 });
  await put(`reads/${id()}`, { bookId: b, status, start, end, page: status === "lido" ? pages : page, ratings, overall, review: "", createdAt: t0 - i * 1000 });
  if (title === "Dom Casmurro") {
    await put(`notes/${id()}`, { bookId: b, type: "citacao", page: 12, text: "A vida é uma ópera e uma grande ópera.", date: `${y}-02-12`, createdAt: t0 });
    await put(`notes/${id()}`, { bookId: b, type: "reflexao", page: 140, text: "Bentinho é um narrador em quem não dá para confiar. Tudo o que sei de Capitu passa pelo ciúme dele.", date: `${y}-02-25`, createdAt: t0 + 1 });
    await put(`notes/${id()}`, { bookId: b, type: "resumo", page: null, text: "Memórias de Bento Santiago, do amor de infância por Capitu até a suspeita de traição com Escobar.", date: `${y}-03-02`, createdAt: t0 + 2 });
  }
}
await put(`goals/${y}`, { books: 15, pages: 5000 });
console.log(`${BOOKS.length} livros de exemplo em ${base}`);
