const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { parseM3U, groupContent, cleanTitleForTMDB } = require("./parse-m3u");

const LOGO_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'>
  <defs>
    <linearGradient id='bg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#1a1a2e'/>
      <stop offset='100%' stop-color='#0f3460'/>
    </linearGradient>
    <linearGradient id='txt' x1='0%' y1='0%' x2='100%' y2='0%'>
      <stop offset='0%' stop-color='#00d4ff'/>
      <stop offset='100%' stop-color='#0077ff'/>
    </linearGradient>
  </defs>
  <rect width='256' height='256' rx='48' fill='url(#bg)'/>
  <rect x='20' y='20' width='216' height='216' rx='36' fill='none' stroke='#00d4ff' stroke-width='3' stroke-opacity='0.3'/>
  <text x='128' y='168' font-family='Arial Black,sans-serif' font-size='96' font-weight='900' text-anchor='middle' fill='url(#txt)'>M3U</text>
</svg>`;
const LOGO = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

const PORT         = process.env.PORT || 7000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const M3U_URLS = process.env.M3U_URLS
  ? process.env.M3U_URLS.split(",").map(u => u.trim())
  : [];

const SINGLE_URL = process.env.M3U_URL;
if (SINGLE_URL && !M3U_URLS.includes(SINGLE_URL)) M3U_URLS.push(SINGLE_URL);

if (!M3U_URLS.length) {
  console.error("❌ No configuraste M3U_URLS ni M3U_URL");
  process.exit(1);
}

if (!TMDB_API_KEY) {
  console.warn("⚠️  TMDB_API_KEY no configurada — los IDs IMDb no se resolverán");
}

const tmdbCache       = {};
let movies            = [];
let series            = {};
const movieImdbIndex  = {};
const seriesImdbIndex = {};

function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/1080p|720p|2160p|4k|hdr|webrip|bluray|x264|x265/gi, "")
    .replace(/latino|castellano|dual|subtitulado|sub/gi, "")
    .replace(/s\d{1,2}e\d{1,2}/gi, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function searchTMDB(title, type) {
  if (!TMDB_API_KEY) return null;
  const clean = normalize(cleanTitleForTMDB(title));
  if (clean in tmdbCache) return tmdbCache[clean];
  try {
    const endpoint  = type === "series" ? "tv" : "movie";
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&language=es-MX`
    );
    const searchData = await searchRes.json();
    if (!searchData.results?.length) { tmdbCache[clean] = null; return null; }
    const detailsRes = await fetch(
      `https://api.themoviedb.org/3/${endpoint}/${searchData.results[0].id}/external_ids?api_key=${TMDB_API_KEY}`
    );
    const details = await detailsRes.json();
    const imdb = details.imdb_id || null;
    tmdbCache[clean] = imdb;
    if (imdb) console.log(`✅ TMDB: "${clean}" → ${imdb}`);
    return imdb;
  } catch (err) {
    console.error(`❌ TMDB error "${title}":`, err.message);
    tmdbCache[clean] = null;
    return null;
  }
}

async function prefetchTMDBIds() {
  if (!TMDB_API_KEY) return;

  const movieList  = movies.filter(m => !m.id.startsWith("tt"));
  const seriesList = Object.values(series).filter(s => !s.id.startsWith("tt"));

  console.log(`⏳ Pre-carga TMDB: ${movieList.length} películas + ${seriesList.length} series`);

  let resolvedMovies = 0;
  for (const batch of chunks(movieList, 4)) {
    await Promise.all(batch.map(async movie => {
      const imdb = await searchTMDB(movie.title, "movie");
      if (imdb) { movieImdbIndex[imdb] = movie.id; movie.id = imdb; resolvedMovies++; }
    }));
    console.log(`🎬 Películas resueltas: ${resolvedMovies}/${movieList.length}`);
    await sleep(400);
  }
  console.log("✅ Pre-carga de películas completada");

  let resolvedSeries = 0;
  for (const batch of chunks(seriesList, 4)) {
    await Promise.all(batch.map(async show => {
      const imdb = await searchTMDB(show.title, "series");
      if (imdb) { seriesImdbIndex[imdb] = show.id; show.id = imdb; resolvedSeries++; }
    }));
    console.log(`📺 Series resueltas: ${resolvedSeries}/${seriesList.length}`);
    await sleep(400);
  }
  console.log("✅ Pre-carga de series completada");
}

async function loadList() {
  let allItems = [];
  for (const url of M3U_URLS) {
    console.log(`📥 Descargando: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) { console.error(`❌ HTTP ${response.status}: ${url}`); continue; }
      const items = parseM3U(await response.text());
      console.log(`📺 ${items.length} items en ${url}`);
      allItems = allItems.concat(items);
    } catch (err) {
      console.error(`❌ Error descargando ${url}:`, err.message);
    }
  }
  const grouped = groupContent(allItems);
  movies = grouped.movies;
  series = grouped.series;
  console.log(`✅ ${movies.length} películas | ${Object.keys(series).length} series`);
}

// ─────────────────────────────────────────────
// KEEP-ALIVE — ping cada 14 min para evitar
// que Render duerma el servicio en plan gratuito
// ─────────────────────────────────────────────
function startKeepAlive(baseUrl) {
  setInterval(async () => {
    try {
      await fetch(`${baseUrl}/manifest.json`);
      console.log(`💓 Keep-alive OK`);
    } catch (err) {
      console.error(`❌ Keep-alive error:`, err.message);
    }
  }, 14 * 60 * 1000);
}

const manifest = {
  id:          "com.esmequinn.m3u",
  version:     "1.0.0",
  name:        "M3U IPTV",
  description: "Tu lista M3U con búsqueda automática de IDs IMDb",
  logo:        LOGO,
  resources:   ["catalog", "stream", "meta"],
  types:       ["movie", "series"],
  catalogs: [
    {
      type:  "movie",
      id:    "m3u_movies",
      name:  "Mis Películas",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip",   isRequired: false }
      ]
    },
    {
      type:  "series",
      id:    "m3u_series",
      name:  "Mis Series",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip",   isRequired: false }
      ]
    }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const search = extra?.search ? normalize(extra.search) : null;
  const skip   = parseInt(extra?.skip || "0", 10);
  const PAGE   = 100;

  if (type === "movie" && id === "m3u_movies") {
    let results = movies;
    if (search) results = movies.filter(m => normalize(m.title).includes(search));
    return { metas: results.slice(skip, skip + PAGE).map(movieToMeta) };
  }

  if (type === "series" && id === "m3u_series") {
    let results = Object.values(series);
    if (search) results = results.filter(s => normalize(s.title).includes(search));
    return { metas: results.slice(skip, skip + PAGE).map(seriesToMeta) };
  }

  return { metas: [] };
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type === "movie") {
    const slugKey = movieImdbIndex[id] || id;
    let movie = movies.find(m => m.id === id || m.id === slugKey)
      || movies.find(m => normalize(m.title) === normalize(id));
    if (!movie) return { meta: null };
    if (!movie.id.startsWith("tt")) {
      const imdb = await searchTMDB(movie.title, "movie");
      if (imdb) { movieImdbIndex[imdb] = movie.id; movie.id = imdb; }
    }
    return { meta: movieToFullMeta(movie) };
  }

  if (type === "series") {
    const slugKey = seriesImdbIndex[id] || id;
    let show = series[slugKey] || series[id]
      || Object.values(series).find(s => normalize(s.title) === normalize(id));
    if (!show) return { meta: null };
    if (!show.id.startsWith("tt")) {
      const imdb = await searchTMDB(show.title, "series");
      if (imdb) { seriesImdbIndex[imdb] = show.id; show.id = imdb; }
    }
    return { meta: seriesToFullMeta(show, show.id) };
  }

  return { meta: null };
});

builder.defineStreamHandler(async ({ type, id }) => {
  if (type === "movie") {
    const slugKey = movieImdbIndex[id] || id;
    const movie = movies.find(m => m.id === id || m.id === slugKey)
      || movies.find(m => normalize(m.title) === normalize(id));
    if (!movie) return { streams: [] };
    return {
      streams: movie.streams.map((s, i) => ({
        url: s.url, name: "M3U", title: `Stream ${i + 1}`
      }))
    };
  }

  if (type === "series") {
    const parts   = id.split(":");
    const rawId   = parts[0];
    const season  = parseInt(parts[1], 10);
    const episode = parseInt(parts[2], 10);
    const slugKey = seriesImdbIndex[rawId] || rawId;
    const show = series[slugKey] || series[rawId]
      || Object.values(series).find(s =>
          normalize(s.title) === normalize(rawId) || s.id === rawId
        );
    if (!show) return { streams: [] };
    const eps = show.episodes.filter(
      e => e.season === season && e.episode === episode
    );
    return {
      streams: eps.map((ep, i) => ({ url: ep.url, name: "M3U", title: `Stream ${i + 1}` }))
    };
  }

  return { streams: [] };
});

function movieToMeta(m) {
  return { id: m.id, type: "movie", name: m.title, poster: m.poster };
}

function movieToFullMeta(m) {
  return { ...movieToMeta(m), description: "Película de tu lista M3U" };
}

function seriesToMeta(s) {
  return { id: s.id, type: "series", name: s.title, poster: s.poster };
}

function seriesToFullMeta(s, resolvedId) {
  return {
    id:     resolvedId,
    type:   "series",
    name:   s.title,
    poster: s.poster,
    videos: s.episodes.map(ep => ({
      id:     `${resolvedId}:${ep.season}:${ep.episode}`,
      title:  ep.title,
      season: ep.season,
      number: ep.episode
    }))
  };
}

(async () => {
  await loadList();

  serveHTTP(builder.getInterface(), { port: PORT });
  console.log(`🚀 Addon corriendo en puerto ${PORT}`);

  // Keep-alive usando URL pública de Render
  const publicUrl = process.env.RENDER_EXTERNAL_URL;
  if (publicUrl) {
    console.log(`💓 Keep-alive iniciado: ${publicUrl}`);
    startKeepAlive(publicUrl);
  }

  console.log("⏳ Iniciando pre-carga de IDs TMDB en segundo plano...");
  prefetchTMDBIds().catch(err => console.error("❌ Error en pre-carga:", err));
})();
