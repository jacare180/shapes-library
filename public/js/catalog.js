// Book catalogs (Google Books and Open Library), shared by the page and the Worker.
// The page asks them directly first: Google Books without a key counts queries per caller, and a
// Worker shares its address with many sites, so its quota runs out (seen as 429 "Queries per day").
// The Worker (/api/search) stays as the fallback and is the only place a GOOGLE_BOOKS_KEY is used.

const ISBN = /^(97[89])?\d{9}[\dx]$/i;

export function googleURL(q, key = "") {
  const clean = q.replace(/[-\s]/g, "");
  const query = ISBN.test(clean) ? `isbn:${clean}` : q;
  return `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12&printType=books${key ? `&key=${key}` : ""}`;
}

export function openLibraryURL(q) {
  const clean = q.replace(/[-\s]/g, "");
  const fields = "title,subtitle,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,subject";
  const query = ISBN.test(clean) ? `isbn=${clean}` : `q=${encodeURIComponent(q)}`;
  return `https://openlibrary.org/search.json?${query}&limit=12&fields=${fields}`;
}

export const fromGoogle = (d) =>
  (d.items || []).map(({ volumeInfo: v = {} }) => ({
    title: [v.title, v.subtitle].filter(Boolean).join(": "),
    authors: v.authors || [],
    year: parseInt(v.publishedDate, 10) || null,
    pages: v.pageCount || null,
    cover: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "").replace(/^http:/, "https:").replace("&edge=curl", ""),
    isbn: (v.industryIdentifiers || []).find((i) => i.type === "ISBN_13")?.identifier || "",
    genre: (v.categories || [])[0] || "",
    source: "Google Books",
  }));

export const fromOpenLibrary = (d) =>
  (d.docs || []).map((b) => ({
    title: [b.title, b.subtitle].filter(Boolean).join(": "),
    authors: b.author_name || [],
    year: b.first_publish_year || null,
    pages: b.number_of_pages_median || null,
    cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : "",
    isbn: (b.isbn || []).find((i) => i.length === 13) || (b.isbn || [])[0] || "",
    genre: (b.subject || [])[0] || "",
    source: "Open Library",
  }));

export function fetchJSON(url, ms = 10000, headers = {}) {
  return fetch(url, { signal: AbortSignal.timeout(ms), headers }).then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(r.status === 429 ? "limite diário" : `erro ${r.status}`)));
}

// Same book from two catalogs (or two editions with the same title and author) shows once,
// keeping whichever copy has more of cover, pages and ISBN.
export function merge(lists) {
  const score = (b) => !!b.cover + !!b.pages + !!b.isbn;
  const best = new Map();
  for (const b of lists.flat()) {
    if (!b.title) continue;
    const k = `${b.title.toLowerCase().split(":")[0].trim()}|${(b.authors[0] || "").toLowerCase()}`;
    const cur = best.get(k);
    if (!cur) best.set(k, b);
    else if (score(b) > score(cur)) best.set(k, { ...b, cover: b.cover || cur.cover, pages: b.pages || cur.pages, isbn: b.isbn || cur.isbn });
    else best.set(k, { ...cur, cover: cur.cover || b.cover, pages: cur.pages || b.pages, isbn: cur.isbn || b.isbn });
  }
  return [...best.values()];
}
