const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const https = require("https");
const { parseM3U, groupContent } = require("./parse-m3u");

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 7000;

const M3U_URL = process.env.M3U_URL;

// ─────────────────────────────────────────────────────────────────────────────

// DATA

let movies = [];
let series = {};

// ─────────────────────────────────────────────────────────────────────────────
// DESCARGAR M3U
// ─────────────────────────────────────────────────────────────────────────────

function fetchM3U(url) {

  return new Promise((resolve, reject) => {

    https.get(url, {

      headers: {
        "User-Agent": "Mozilla/5.0"
      }

    }, (res) => {

      // redirects GitHub Releases
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {

        console.log("↪ Redirect detectado");

        return resolve(fetchM3U(res.headers.location));
      }

      let data = "";

      res.on("data", chunk => {
        data += chunk;
      });

      res.on("end", () => {

        console.log("📦 Tamaño descargado:", data.length);

        resolve(data);
      });

    }).on("error", reject);

  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR LISTA
// ─────────────────────────────────────────────────────────────────────────────

async function loadList() {

  if (!M3U_URL) {

    console.warn("⚠ No se definió M3U_URL");

    return;
  }

  try {

    console.log("📥 Descargando lista M3U...");

    const raw = await fetchM3U(M3U_URL);

    console.log("📄 Parseando M3U...");

    const items = parseM3U(raw);

    console.log("📺 Items encontrados:", items.length);

    const grouped = groupContent(items);

    movies = grouped.movies;

    series = grouped.series;

    console.log(
      `✅ Lista cargada: ${movies.length} películas, ${Object.keys(series).length} series`
    );

  } catch (err) {

    console.error("❌ Error cargando M3U:", err);
  }
}

loadList();

// ─────────────────────────────────────────────────────────────────────────────
// MANIFEST
// ─────────────────────────────────────────────────────────────────────────────

const manifest = {

  id: "com.miaddon.m3u",

  version: "1.0.0",

  name: "Mi Lista M3U",

  description: "Películas y series desde tu lista M3U personal",

  logo: "https://i.imgur.com/qKMZMBx.png",

  resources: ["catalog", "stream", "meta"],

  types: ["movie", "series"],

  catalogs: [

    {
      type: "movie",
      id: "m3u_movies",
      name: "Mis Películas",
      extra: [{ name: "search", isRequired: false }],
    },

    {
      type: "series",
      id: "m3u_series",
      name: "Mis Series",
      extra: [{ name: "search", isRequired: false }],
    },
  ],

  behaviorHints: {
    adult: false,
    p2p: false
  },
};

const builder = new addonBuilder(manifest);

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

builder.defineCatalogHandler(({ type, id, extra }) => {

  const search =
    (extra && extra.search)
      ? extra.search.toLowerCase()
      : null;

  if (type === "movie" && id === "m3u_movies") {

    let metas = movies.map(movieToMeta);

    if (search) {

      metas = metas.filter(m =>
        m.name.toLowerCase().includes(search)
      );
    }

    return Promise.resolve({ metas });
  }

  if (type === "series" && id === "m3u_series") {

    let metas = Object.values(series).map(seriesToMeta);

    if (search) {

      metas = metas.filter(m =>
        m.name.toLowerCase().includes(search)
      );
    }

    return Promise.resolve({ metas });
  }

  return Promise.resolve({ metas: [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// META
// ─────────────────────────────────────────────────────────────────────────────

builder.defineMetaHandler(({ type, id }) => {

  if (type === "movie") {

    const movie = movies.find(m => m.id === id);

    if (!movie) {

      return Promise.resolve({ meta: null });
    }

    return Promise.resolve({
      meta: movieToFullMeta(movie)
    });
  }

  if (type === "series") {

    const show = series[id];

    if (!show) {

      return Promise.resolve({ meta: null });
    }

    return Promise.resolve({
      meta: seriesToFullMeta(show, id)
    });
  }

  return Promise.resolve({ meta: null });
});

// ─────────────────────────────────────────────────────────────────────────────
// STREAMS
// ─────────────────────────────────────────────────────────────────────────────

builder.defineStreamHandler(({ type, id }) => {

  if (type === "movie") {

    const movie = movies.find(m => m.id === id);

    if (!movie) {

      return Promise.resolve({ streams: [] });
    }

    return Promise.resolve({

      streams: [

        {
          url: movie.url,
          title: "▶ Reproducir",
          name: "M3U"
        }
      ]
    });
  }

  if (type === "series") {

    const parts = id.split(":");

    const seriesId = parts[0];

    const season = parseInt(parts[1], 10);

    const episode = parseInt(parts[2], 10);

    const show = series[seriesId];

    if (!show) {

      return Promise.resolve({ streams: [] });
    }

    const ep = (show.episodes || []).find(

      e =>
        e.season === season &&
        e.episode === episode
    );

    if (!ep) {

      return Promise.resolve({ streams: [] });
    }

    return Promise.resolve({

      streams: [

        {
          url: ep.url,
          title: `▶ S${pad(season)}E${pad(episode)}`,
          name: "M3U"
        }
      ]
    });
  }

  return Promise.resolve({ streams: [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function movieToMeta(m) {

  return {

    id: m.id,

    type: "movie",

    name: m.title,

    poster: m.poster || makePosterUrl(m.title),

    background: m.background || null,

    genres: m.genres || [],
  };
}

function movieToFullMeta(m) {

  return {

    ...movieToMeta(m),

    description:
      m.description ||
      "Película de tu lista M3U personal.",

    year: m.year || null,
  };
}

function seriesToMeta(s) {

  return {

    id: s.id,

    type: "series",

    name: s.title,

    poster: s.poster || makePosterUrl(s.title),

    genres: s.genres || [],
  };
}

function seriesToFullMeta(s, id) {

  const seasons = {};

  (s.episodes || []).forEach(ep => {

    if (!seasons[ep.season]) {

      seasons[ep.season] = [];
    }

    seasons[ep.season].push({

      id: `${id}:${ep.season}:${ep.episode}`,

      title:
        ep.title ||
        `Episodio ${ep.episode}`,

      season: ep.season,

      number: ep.episode,

      overview: ep.description || "",
    });
  });

  return {

    id,

    type: "series",

    name: s.title,

    poster: s.poster || makePosterUrl(s.title),

    description:
      s.description ||
      "Serie de tu lista M3U personal.",

    videos:
      Object.entries(seasons)
        .flatMap(([, eps]) => eps),
  };
}

function makePosterUrl(title) {

  const encoded =
    encodeURIComponent(title);

  return `https://via.placeholder.com/300x450/1a1a2e/ffffff?text=${encoded}`;
}

function pad(n) {

  return String(n).padStart(2, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

serveHTTP(
  builder.getInterface(),
  { port: PORT }
);

console.log(`\n🚀 Addon Stremio corriendo en puerto ${PORT}`);

console.log(`📡 Manifest: /manifest.json\n`);
