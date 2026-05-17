const { addonBuilder, serveHTTP } =
  require("stremio-addon-sdk");

const axios = require("axios");

const {
  parseM3U,
  groupContent
} = require("./parse-m3u");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const PORT =
  process.env.PORT || 7000;

const M3U_URL =
  process.env.M3U_URL;

// ─────────────────────────────────────────────
// VALIDAR URL
// ─────────────────────────────────────────────

if (!M3U_URL) {

  console.error(
    "❌ M3U_URL no configurado"
  );

  process.exit(1);
}

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────

let movies = [];

let series = {};

// ─────────────────────────────────────────────
// LOAD LIST
// ─────────────────────────────────────────────

async function loadList() {

  try {

    console.log(
      "📥 Descargando lista M3U..."
    );

    const response =
      await axios.get(M3U_URL, {

        maxRedirects: 5,

        responseType: "text",

        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      });

    if (
      response.request?.res?.responseUrl !==
      M3U_URL
    ) {

      console.log(
        "↪ Redirect detectado"
      );
    }

    const raw =
      response.data;

    console.log(
      `📦 Tamaño descargado: ${raw.length}`
    );

    console.log(
      "📄 Parseando M3U..."
    );

    const items =
      parseM3U(raw);

    console.log(
      `📺 Items encontrados: ${items.length}`
    );

    const grouped =
      groupContent(items);

    movies =
      grouped.movies;

    series =
      grouped.series;

    console.log(
      `✅ Lista cargada: ${movies.length} películas, ${Object.keys(series).length} series`
    );

  } catch (err) {

    console.error(
      "❌ Error cargando M3U:"
    );

    console.error(
      err.message
    );
  }
}

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
      extra?.search
        ?.toLowerCase() || null;

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
        movies.find(
          m => m.id === id
        );

      if (!movie) {

        return Promise.resolve({
          meta: null
        });
      }

      return Promise.resolve({

        meta:
          movieToFullMeta(movie)
      });
    }

    if (type === "series") {

      const show =
        series[id];

      if (!show) {

        return Promise.resolve({
          meta: null
        });
      }

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

    // MOVIES
    if (type === "movie") {

      const movie =
        movies.find(
          m => m.id === id
        );

      if (!movie) {

        return Promise.resolve({
          streams: []
        });
      }

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

    // SERIES
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

      if (!show) {

        return Promise.resolve({
          streams: []
        });
      }

      const ep =
        show.episodes.find(
          e =>
            e.season === season &&
            e.episode === episode
        );

      if (!ep) {

        return Promise.resolve({
          streams: []
        });
      }

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

  if (t.includes("latino")) {
    langs.push("Latino");
  }

  if (t.includes("castellano")) {
    langs.push("Castellano");
  }

  if (
    t.includes("english") ||
    t.includes("ingles")
  ) {
    langs.push("Inglés");
  }

  if (t.includes("sub")) {
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

    poster: m.poster,

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

    poster: s.poster,

    genres:
      s.genres || []
  };
}

function seriesToFullMeta(s, id) {

  const seasons = {};

  s.episodes.forEach(ep => {

    if (!seasons[ep.season]) {

      seasons[ep.season] = [];
    }

    seasons[ep.season].push({

      id:
        `${id}:${ep.season}:${ep.episode}`,

      title:
        ep.title,

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

    poster: s.poster,

    videos:
      Object.values(seasons)
        .flat()
  };
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

(async () => {

  await loadList();

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
})();
