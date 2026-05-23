const { addonBuilder, serveHTTP } =
  require("stremio-addon-sdk");

const {
  parseM3U,
  groupContent
} = require("./parse-m3u");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const PORT =
  process.env.PORT || 7000;

// MULTI URLS
const M3U_URLS =
  process.env.M3U_URLS
    ? process.env.M3U_URLS
        .split(",")
        .map(u => u.trim())
    : [];

const SINGLE_URL =
  process.env.M3U_URL;

if (
  SINGLE_URL &&
  !M3U_URLS.includes(SINGLE_URL)
) {
  M3U_URLS.push(SINGLE_URL);
}

if (!M3U_URLS.length) {

  console.error(
    "❌ No configuraste M3U_URL o M3U_URLS"
  );

  process.exit(1);
}

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────

let movies = [];

let series = {};

// ─────────────────────────────────────────────
// LOAD LISTS
// ─────────────────────────────────────────────

async function loadList() {

  try {

    let allItems = [];

    for (const url of M3U_URLS) {

      console.log(
        `📥 Descargando: ${url}`
      );

      const response =
        await fetch(url);

      if (!response.ok) {

        console.log(
          `❌ Error HTTP ${response.status}`
        );

        continue;
      }

      const raw =
        await response.text();

      console.log(
        `📦 Tamaño: ${raw.length}`
      );

      const items =
        parseM3U(raw);

      console.log(
        `📺 Items encontrados: ${items.length}`
      );

      allItems.push(...items);
    }

    console.log(
      `🎬 Total items: ${allItems.length}`
    );

    const grouped =
      groupContent(allItems);

    movies =
      grouped.movies;

    series =
      grouped.series;

    console.log(
      `✅ Lista cargada: ${movies.length} películas, ${Object.keys(series).length} series`
    );

  } catch (err) {

    console.error(
      "❌ Error cargando listas:"
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

  id: "com.esmequinn.m3u",

  version: "2.0.0",

  name: "M3U",

  description:
    "Addon IPTV M3U para Stremio",

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

    // MOVIES
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

    // SERIES
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

    // MOVIES
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

    // SERIES
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

        streams:

          movie.streams.map(s => ({

            url: s.url,

            title:
              `${s.language}`,

            name: "M3U"
          }))
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

      const episodes =

        show.episodes.filter(
          e =>
            e.season === season &&
            e.episode === episode
        );

      if (!episodes.length) {

        return Promise.resolve({
          streams: []
        });
      }

      return Promise.resolve({

        streams:

          episodes.map(ep => ({

            url: ep.url,

            title:
              `${ep.language}`,

            name: "M3U"
          }))
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