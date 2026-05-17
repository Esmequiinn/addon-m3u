const { addonBuilder, serveHTTP } =
  require("stremio-addon-sdk");

const fs = require("fs");

const path = require("path");

const {
  parseM3U,
  groupContent
} = require("./parse-m3u");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const PORT =
  process.env.PORT || 7000;

const M3U_PATH =
  process.env.M3U_PATH ||
  path.join(__dirname, "lista.m3u");

// ─────────────────────────────────────────────
// LOAD LIST
// ─────────────────────────────────────────────

let movies = [];

let series = {};

function loadList() {

  if (!fs.existsSync(M3U_PATH)) {

    console.warn(
      `⚠️ No se encontró: ${M3U_PATH}`
    );

    return;
  }

  const raw =
    fs.readFileSync(M3U_PATH, "utf8");

  const items =
    parseM3U(raw);

  const grouped =
    groupContent(items);

  movies = grouped.movies;

  series = grouped.series;

  console.log(
    `✅ Lista cargada: ${movies.length} películas, ${Object.keys(series).length} series`
  );
}

loadList();

// ─────────────────────────────────────────────
// MANIFEST
// ─────────────────────────────────────────────

const manifest = {

  id: "com.miaddon.m3u",

  version: "1.0.0",

  name: "Mi Lista M3U",

  description:
    "Películas y series desde lista M3U",

  logo:
    "https://i.imgur.com/qKMZMBx.png",

  resources: [
    "catalog",
    "stream",
    "meta"
  ],

  types: [
    "movie",
    "series"
  ],

  catalogs: [

    {
      type: "movie",

      id: "m3u_movies",

      name: "Mis Películas",

      extra: [
        {
          name: "search",
          isRequired: false
        }
      ]
    },

    {
      type: "series",

      id: "m3u_series",

      name: "Mis Series",

      extra: [
        {
          name: "search",
          isRequired: false
        }
      ]
    }
  ],

  behaviorHints: {
    adult: false,
    p2p: false
  }
};

const builder =
  new addonBuilder(manifest);

// ─────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────

builder.defineCatalogHandler(
  ({ type, id, extra }) => {

    const search =
      extra && extra.search
        ? extra.search.toLowerCase()
        : null;

    if (
      type === "movie" &&
      id === "m3u_movies"
    ) {

      let metas =
        movies.map(movieToMeta);

      if (search) {

        metas =
          metas.filter(m =>
            m.name
              .toLowerCase()
              .includes(search)
          );
      }

      return Promise.resolve({
        metas
      });
    }

    if (
      type === "series" &&
      id === "m3u_series"
    ) {

      let metas =
        Object.values(series)
          .map(seriesToMeta);

      if (search) {

        metas =
          metas.filter(m =>
            m.name
              .toLowerCase()
              .includes(search)
          );
      }

      return Promise.resolve({
        metas
      });
    }

    return Promise.resolve({
      metas: []
    });
  }
);

// ─────────────────────────────────────────────
// META
// ─────────────────────────────────────────────

builder.defineMetaHandler(
  ({ type, id }) => {

    if (type === "movie") {

      const movie =
        movies.find(m => m.id === id);

      if (!movie)
        return Promise.resolve({
          meta: null
        });

      return Promise.resolve({
        meta:
          movieToFullMeta(movie)
      });
    }

    if (type === "series") {

      const show =
        series[id];

      if (!show)
        return Promise.resolve({
          meta: null
        });

      return Promise.resolve({
        meta:
          seriesToFullMeta(show, id)
      });
    }

    return Promise.resolve({
      meta: null
    });
  }
);

// ─────────────────────────────────────────────
// STREAMS
// ─────────────────────────────────────────────

builder.defineStreamHandler(
  ({ type, id }) => {

    // ─────────────────────────────────────────
    // MOVIES
    // ─────────────────────────────────────────

    if (type === "movie") {

      const movie =
        movies.find(m => m.id === id);

      if (!movie)
        return Promise.resolve({
          streams: []
        });

      return Promise.resolve({

        streams: [

          {
            url: movie.url,

            title:
              detectLanguage(
                movie.title
              ),

            name: "M3U"
          }
        ]
      });
    }

    // ─────────────────────────────────────────
    // SERIES
    // ─────────────────────────────────────────

    if (type === "series") {

      const parts =
        id.split(":");

      const seriesId =
        parts[0];

      const season =
        parseInt(parts[1], 10);

      const episode =
        parseInt(parts[2], 10);

      const show =
        series[seriesId];

      if (!show)
        return Promise.resolve({
          streams: []
        });

      const ep =
        (show.episodes || [])
          .find(
            e =>
              e.season === season &&
              e.episode === episode
          );

      if (!ep)
        return Promise.resolve({
          streams: []
        });

      return Promise.resolve({

        streams: [

          {
            url: ep.url,

            title:
              detectLanguage(
                ep.title
              ),

            name: "M3U"
          }
        ]
      });
    }

    return Promise.resolve({
      streams: []
    });
  }
);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function detectLanguage(title) {

  const t =
    title.toLowerCase();

  const langs = [];

  if (
    t.includes("latino")
  ) {
    langs.push("Latino");
  }

  if (
    t.includes("castellano")
  ) {
    langs.push("Castellano");
  }

  if (
    t.includes("english") ||
    t.includes("ingles")
  ) {
    langs.push("Inglés");
  }

  if (
    t.includes("sub")
  ) {
    langs.push("Sub");
  }

  if (langs.length === 0) {

    return "M3U";
  }

  return langs.join(" • ");
}

function movieToMeta(m) {

  return {

    id: m.id,

    type: "movie",

    name: m.title,

    poster:
      m.poster ||
      makePosterUrl(m.title),

    background: null,

    genres:
      m.genres || []
  };
}

function movieToFullMeta(m) {

  return {

    ...movieToMeta(m),

    description:
      "Película desde lista M3U"
  };
}

function seriesToMeta(s) {

  return {

    id: s.id,

    type: "series",

    name: s.title,

    poster:
      s.poster ||
      makePosterUrl(s.title),

    genres:
      s.genres || []
  };
}

function seriesToFullMeta(s, id) {

  const seasons = {};

  (s.episodes || [])
    .forEach(ep => {

      if (!seasons[ep.season]) {

        seasons[ep.season] = [];
      }

      seasons[ep.season].push({

        id:
          `${id}:${ep.season}:${ep.episode}`,

        title:
          ep.title ||

          `Episodio ${ep.episode}`,

        season:
          ep.season,

        number:
          ep.episode
      });
    });

  return {

    id,

    type: "series",

    name: s.title,

    poster:
      s.poster ||
      makePosterUrl(s.title),

    description:
      "Serie desde lista M3U",

    videos:
      Object.entries(seasons)
        .flatMap(([, eps]) => eps)
  };
}

function makePosterUrl(title) {

  return `https://via.placeholder.com/300x450/1a1a2e/ffffff?text=${encodeURIComponent(title)}`;
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

serveHTTP(
  builder.getInterface(),
  { port: PORT }
);

console.log(
  `🚀 Addon corriendo en puerto ${PORT}`
);

console.log(
  `📡 Manifest: /manifest.json`
);
