const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { parseM3U, groupContent } = require("./parse-m3u");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// CACHE EN MEMORIA
// ─────────────────────────────────────────────
const tmdbCache = {};   // normalizedTitle → imdbId | null

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
let movies = [];
let series = {};

// Índices cruzados: imdbId → id-slug original
const movieImdbIndex  = {};
const seriesImdbIndex = {};

// ─────────────────────────────────────────────
// NORMALIZE (para búsquedas y comparaciones)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// TMDB SEARCH  (una sola función, usada en todos lados)
// ─────────────────────────────────────────────
async function searchTMDB(title, type) {
  if (!TMDB_API_KEY) return null;

  const clean = normalize(title);
  if (clean in tmdbCache) return tmdbCache[clean]; // null también es válido

  try {
    const endpoint = type === "series" ? "tv" : "movie";
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/${endpoint}` +
      `?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&language=es-MX`
    );
    const searchData = await searchRes.json();

    if (!searchData.results?.length) {
      tmdbCache[clean] = null;
      return null;
    }

    const detailsRes = await fetch(
      `https://api.themoviedb.org/3/${endpoint}/${searchData.results[0].id}/external_ids` +
      `?api_key=${TMDB_API_KEY}`
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

// ─────────────────────────────────────────────
// PRE-CARGA DE IDs TMDB EN SEGUNDO PLANO
// Procesa todos los items sin IMDb ID con throttle (300 ms entre requests)
// para no rebasar el límite de TMDB (~40 req / 10 seg en plan gratuito)
// ─────────────────────────────────────────────
async function prefetchTMDBIds() {
  if (!TMDB_API_KEY) return;

  const DELAY_MS = 300; // ~3 req/seg → muy por debajo del límite

  // Películas sin IMDb
  for (const movie of movies) {
    if (movie.id.startsWith("tt")) continue;
    const imdb = await searchTMDB(movie.title, "movie");
    if (imdb) {
      movieImdbIndex[imdb] = movie.id;
      movie.id = imdb;
    }
    await sleep(DELAY_MS);
  }

  console.log("✅ Pre-carga de películas completada");

  // Series sin IMDb
  for (const show of Object.values(series)) {
    if (show.id.startsWith("tt")) continue;
    const imdb = await searchTMDB(show.title, "series");
    if (imdb) {
      seriesImdbIndex[imdb] = show.id;
      show.id = imdb;
    }
    await sleep(DELAY_MS);
  }

  console.log("✅ Pre-carga de series completada");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// LOAD LISTS
// ─────────────────────────────────────────────
async function loadList() {
  let allItems = [];

  for (const url of M3U_URLS) {
    console.log(`📥 Descargando: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) { console.error(`❌ HTTP ${response.status}: ${url}`); continue; }
      const items = parseM3U(await response.text());
      console.log(`📺 ${items.length} items en ${url}`);
      allItems.push(...items);
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
// MANIFEST
// ─────────────────────────────────────────────
const manifest = {
  id: "com.esmequinn.m3u",
  version: "5.0.0",
  name: "M3U IPTV",
  description: "Tu lista M3U con búsqueda y resolución automática de IDs IMDb",
  resources: ["catalog", "stream", "meta"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "m3u_movies",
      name: "🎬 Mis Películas",
      // ✅ FIX BÚSQUEDA: declarar soporte para search y skip (paginación)
      extra: [
        { name: "search", isRequired: false },
        { name: "skip",   isRequired: false }
      ]
    },
    {
      type: "series",
      id: "m3u_series",
      name: "📺 Mis Series",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip",   isRequired: false }
      ]
    }
  ]
};

const builder = new addonBuilder(manifest);

// ─────────────────────────────────────────────
// CATALOG  — con filtro de búsqueda
// ─────────────────────────────────────────────
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const search = extra?.search ? normalize(extra.search) : null;
  const skip   = parseInt(extra?.skip || "0", 10);
  const PAGE   = 100; // items por página

  if (type === "movie" && id === "m3u_movies") {
    let results = movies;

    // ✅ FIX BÚSQUEDA: filtrar si viene query
    if (search) {
      results = movies.filter(m => normalize(m.title).includes(search));
    }

    return {
      metas: results
        .slice(skip, skip + PAGE)
        .map(movieToMeta)
    };
  }

  if (type === "series" && id === "m3u_series") {
    let results = Object.values(series);

    if (search) {
      results = results.filter(s => normalize(s.title).includes(search));
    }

    return {
      metas: results
        .slice(skip, skip + PAGE)
        .map(seriesToMeta)
    };
  }

  return { metas: [] };
});

// ─────────────────────────────────────────────
// META
// ─────────────────────────────────────────────
builder.defineMetaHandler(async ({ type, id }) => {

  if (type === "movie") {
    const slugKey = movieImdbIndex[id] || id;
    let movie = movies.find(m => m.id === id || m.id === slugKey)
      || movies.find(m => normalize(m.title) === normalize(id));

    if (!movie) return { meta: null };

    // Por si aún no tiene IMDb (llegó antes de que la pre-carga llegara a él)
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

// ─────────────────────────────────────────────
// STREAMS
// ─────────────────────────────────────────────
builder.defineStreamHandler(async ({ type, id }) => {

  if (type === "movie") {
    const slugKey = movieImdbIndex[id] || id;
    const movie = movies.find(m => m.id === id || m.id === slugKey)
      || movies.find(m => normalize(m.title) === normalize(id));

    if (!movie) return { streams: [] };

    return {
      streams: movie.streams.map(s => ({
        url: s.url, title: s.language, name: "M3U"
      }))
    };
  }

  if (type === "series") {
    const parts     = id.split(":");
    const rawId     = parts[0];
    const season    = parseInt(parts[1], 10);
    const episode   = parseInt(parts[2], 10);
    const slugKey   = seriesImdbIndex[rawId] || rawId;

    const show = series[slugKey] || series[rawId]
      || Object.values(series).find(s =>
          normalize(s.title) === normalize(rawId) || s.id === rawId
        );

    if (!show) return { streams: [] };

    const eps = show.episodes.filter(
      e => e.season === season && e.episode === episode
    );

    return {
      streams: eps.map(ep => ({ url: ep.url, title: ep.language, name: "M3U" }))
    };
  }

  return { streams: [] };
});

// ─────────────────────────────────────────────
// HELPERS META
// ─────────────────────────────────────────────
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
    id: resolvedId,
    type: "series",
    name: s.title,
    poster: s.poster,
    videos: s.episodes.map(ep => ({
      id:     `${resolvedId}:${ep.season}:${ep.episode}`,
      title:  ep.title,
      season: ep.season,
      number: ep.episode
    }))
  };
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
(async () => {
  await loadList();

  // Arrancar servidor inmediatamente — no esperamos la pre-carga
  serveHTTP(builder.getInterface(), { port: PORT });
  console.log(`🚀 Addon corriendo en puerto ${PORT}`);

  // Pre-carga de IDs TMDB en segundo plano (no bloquea el servidor)
  console.log("⏳ Iniciando pre-carga de IDs TMDB en segundo plano...");
  prefetchTMDBIds().catch(err => console.error("❌ Error en pre-carga:", err));
})();