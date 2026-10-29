// Sample catalog answered when SHAPES_FAKE_SEARCH is set (local runs without internet).
// Mostly without covers, so the app's own leather covers show. Pages and ISBNs here are made up.
const SAMPLE = [
  { title: "Os judeus e as palavras", authors: ["Amos Oz", "Fania Oz-Salzberger"], year: 2012, pages: 200, genre: "History", isbn: "9780000000001", cover: "/icon-512.png" },
  { title: "Homo Deus: Uma Breve História do Amanhã", authors: ["Yuval Noah Harari"], year: 2015, pages: 440, genre: "History", isbn: "9780000000002" },
  { title: "Dom Casmurro", authors: ["Machado de Assis"], year: 1899, pages: 256, genre: "Fiction" },
  { title: "Memórias Póstumas de Brás Cubas", authors: ["Machado de Assis"], year: 1881, pages: 240, genre: "Fiction" },
  { title: "Grande Sertão: Veredas", authors: ["João Guimarães Rosa"], year: 1956, pages: 624, genre: "Fiction" },
  { title: "A Hora da Estrela", authors: ["Clarice Lispector"], year: 1977, pages: 88, genre: "Fiction" },
  { title: "Cem Anos de Solidão", authors: ["Gabriel García Márquez"], year: 1967, pages: 448, genre: "Fiction" },
  { title: "O Nome da Rosa", authors: ["Umberto Eco"], year: 1980, pages: 560, genre: "Fiction" },
  { title: "Sapiens: Uma Breve História da Humanidade", authors: ["Yuval Noah Harari"], year: 2011, pages: 464, genre: "History" },
  { title: "Rápido e Devagar: Duas Formas de Pensar", authors: ["Daniel Kahneman"], year: 2011, pages: 608, genre: "Psychology" },
  { title: "Hábitos Atômicos", authors: ["James Clear"], year: 2018, pages: 320, genre: "Self-Help" },
  { title: "O Pequeno Príncipe", authors: ["Antoine de Saint-Exupéry"], year: 1943, pages: 96, genre: "Fiction" },
  { title: "1984", authors: ["George Orwell"], year: 1949, pages: 416, genre: "Fiction" },
  { title: "Uma Arquitetura do Habitar", authors: ["Juhani Pallasmaa"], year: 2005, pages: 128, genre: "Architecture" },
];

export const fakeSearch = (q) =>
  SAMPLE.filter((b) => {
    const hay = `${b.title} ${b.authors.join(" ")}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w)); // every word, like the real catalogs
  })
    .map((b) => ({ cover: "", isbn: "", ...b, source: "Exemplo" }));
