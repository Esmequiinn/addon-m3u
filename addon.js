const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { parseM3U, groupContent } = require("./parse-m3u");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 7000;

// ✅ FIX #1: Nombre correcto de la variable de entorno
// En Render pon: TMDB_API_KEY = tu_clave
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const M3U_URLS = process.env.M3U_URLS
  ? process.env.M3U_URLS.split(",").map(u => u.trim())
  : [];

const SINGLE_URL = process.env.M3U_URL;
if (SINGLE_URL && !M3U_URLS.includes(SINGLE_URL)) {
  M3U_URLS.push(SINGLE_URL);
}

if (!M3U_URLS.length) {
  console.error("❌ No configuraste M3U_URLS ni M3U_URL");
  process.exit(1);
}

if (!TMDB_API_KEY) {
  console.warn("⚠️  TMDB_API_KEY no configurada — los IDs IMDb no se buscarán automáticamente");
}

// ─────────────────────────────────────────────
// ✅ FIX #2: Cache EN MEMORIA (no en disco)
// Render tiene filesystem efímero — el archivo se borraba en cada reinicio
// ─────────────────────────────────────────────
const tmdbCache = {};

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
let movies = [];
let series = {};

// Índices secundarios: imdbId → slug original
// Para que el stream handler pueda encontrar por IMDb ID
const movieImdbIndex = {};   // imdbId → movieId slug
const seriesImdbIndex = {};  // imdbId → seriesId slug

// ─────────────────────────────────────────────
// NORMALIZE
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
// TMDB SEARCH
// ─────────────────────────────────────────────
async function searchTMDB(title, type) {
  if (!TMDB_API_KEY) return null;

  const clean = normalize(title);
  if (tmdbCache[clean]) return tmdbCache[clean];

  try {
    console.log(`🔎 TMDB buscando: ${clean}`);
    const endpoint = type === "series" ? "tv" : "movie";

    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&language=es-MX`
    );
    const searchData = await searchRes.json();

    if (!searchData.results || !searchData.results.length) {
      tmdbCache[clean] = null;
      return null;
    }

    const first = searchData.results[0];
    const detailsRes = await fetch(
      `https://api.themoviedb.org/3/${endpoint}/${first.id}/external_ids?api_key=${TMDB_API_KEY}`
    );
    const details = await detailsRes.json();

    if (!details.imdb_id) {
      tmdbCache[clean] = null;
      return null;
    }

    // ✅ FIX #2: Solo guardamos en memoria, no en archivo
    tmdbCache[clean] = details.imdb_id;
    console.log(`✅ TMDB: ${clean} → ${details.imdb_id}`);
    return details.imdb_id;

  } catch (err) {
    console.error(`❌ TMDB error para "${title}":`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// LOAD LISTS
// ─────────────────────────────────────────────
async function loadList() {
  try {
    let allItems = [];

    for (const url of M3U_URLS) {
      console.log(`📥 Descargando: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`❌ HTTP ${response.status} al descargar ${url}`);
        continue;
      }
      const raw = await response.text();
      const items = parseM3U(raw);
      console.log(`📺 ${items.length} items en ${url}`);
      allItems.push(...items);
    }

    const grouped = groupContent(allItems);
    movies = grouped.movies;
    series = grouped.series;

    console.log(`✅ ${movies.length} películas cargadas`);
    console.log(`✅ ${Object.keys(series).length} series cargadas`);

  } catch (err) {
    console.error("❌ Error en loadList:", err);
  }
}

// ─────────────────────────────────────────────
// MANIFEST
// ─────────────────────────────────────────────
const manifest = {
  id: "com.esmequinn.m3u",
  version: "4.0.0",
  name: "M3U IPTV",
  description: "Tu lista M3U con búsqueda automática de IDs IMDb via TMDB",
  resources: ["catalog", "stream", "meta"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie",  id: "m3u_movies", name: "🎬 Mis Películas" },
    { type: "series", id: "m3u_series", name: "📺 Mis Series"    }
  ]
};

const builder = new addonBuilder(manifest);

// ─────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────
builder.defineCatalogHandler(async ({ type, id }) => {
  if (type === "movie" && id === "m3u_movies") {
    return { metas: movies.map(movieToMeta) };
  }
  if (type === "series" && id === "m3u_series") {
    return { metas: Object.values(series).map(seriesToMeta) };
  }
  return { metas: [] };
});

// ─────────────────────────────────────────────
// META
// ─────────────────────────────────────────────
builder.defineMetaHandler(async ({ type, id }) => {

  if (type === "movie") {
    // Buscar por ID directo, por índice IMDb, o por título normalizado
    let movie = movies.find(m => m.id === id)
      || (movieImdbIndex[id] ? movies.find(m => m.id === movieImdbIndex[id]) : null)
      || movies.find(m => normalize(m.title) === normalize(id));

    if (!movie) return { meta: null };

    // Buscar IMDb si aún no lo tenemos
    if (!movie.id.startsWith("tt")) {
      const imdb = await searchTMDB(movie.title, "movie");
      if (imdb) {
        // ✅ FIX #4: Guardar índice cruzado slug → imdb
        movieImdbIndex[imdb] = movie.id;
        movie.id = imdb;
      }
    }

    return { meta: movieToFullMeta(movie) };
  }

  if (type === "series") {
    // ✅ FIX #4 & #5: Buscar por slug, por índice IMDb, o por título
    const slugKey = seriesImdbIndex[id] || id;
    let show = series[slugKey]
      || Object.values(series).find(s => normalize(s.title) === normalize(id));

    if (!show) return { meta: null };

    // Buscar IMDb si aún no lo tenemos
    if (!show.id.startsWith("tt")) {
      const imdb = await searchTMDB(show.title, "series");
      if (imdb) {
        // ✅ FIX #4: Guardar índice cruzado para que el stream handler funcione
        seriesImdbIndex[imdb] = show.id; // imdb → slug original
        show.id = imdb;
      }
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
    // ✅ FIX #5: Buscar por ID directo O por índice IMDb→slug
    const slugKey = movieImdbIndex[id] || id;
    const movie = movies.find(m => m.id === id || m.id === slugKey)
      || movies.find(m => normalize(m.title) === normalize(id));

    if (!movie) return { streams: [] };

    return {
      streams: movie.streams.map(s => ({
        url: s.url,
        title: s.language,
        name: "M3U"
      }))
    };
  }

  if (type === "series") {
    const parts = id.split(":");
    const rawSeriesId = parts[0];
    const season  = parseInt(parts[1], 10);
    const episode = parseInt(parts[2], 10);

    // ✅ FIX #5: Buscar por slug directo, por índice IMDb→slug, o por título
    const slugKey = seriesImdbIndex[rawSeriesId] || rawSeriesId;
    const show = series[slugKey]
      || series[rawSeriesId]
      || Object.values(series).find(s =>
          normalize(s.title) === normalize(rawSeriesId) || s.id === rawSeriesId
        );

    if (!show) return { streams: [] };

    const episodes = show.episodes.filter(
      e => e.season === season && e.episode === episode
    );

    return {
      streams: episodes.map(ep => ({
        url: ep.url,
        title: ep.language,
        name: "M3U"
      }))
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
  serveHTTP(builder.getInterface(), { port: PORT });
  console.log(`🚀 Addon corriendo en puerto ${PORT}`);
})();