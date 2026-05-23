const fs =
  require("fs");

const {
  addonBuilder,
  serveHTTP
} = require("stremio-addon-sdk");

const {
  parseM3U,
  groupContent,
  slugify
} = require("./parse-m3u");

// ─────────────────────────────
// CONFIG
// ─────────────────────────────

const PORT =
  process.env.PORT || 7000;

const M3U_URLS =
  process.env.M3U_URLS
    ?.split(",")
    .map(u => u.trim())
    .filter(Boolean) || [];

const TMDB_KEY =
  process.env.TMDB_KEY;

// ─────────────────────────────

if (!M3U_URLS.length) {

  console.error(
    "❌ No hay M3U_URLS"
  );

  process.exit(1);
}

// ─────────────────────────────
// STORAGE
// ─────────────────────────────

let movies = [];

let series = {};

let cache = {};

if (fs.existsSync("cache.json")) {

  cache =
    JSON.parse(
      fs.readFileSync(
        "cache.json",
        "utf8"
      )
    );
}

// ─────────────────────────────
// LOAD ALL LISTS
// ─────────────────────────────

async function loadList(url) {

  try {

    console.log(
      `📥 Descargando:\n${url}`
    );

    const res =
      await fetch(url);

    if (!res.ok) {

      throw new Error(
        `HTTP ${res.status}`
      );
    }

    const raw =
      await res.text();

    console.log(
      `📦 Tamaño: ${raw.length}`
    );

    const items =
      parseM3U(raw);

    console.log(
      `📺 Items: ${items.length}`
    );

    return items;

  } catch (err) {

    console.error(
      `❌ Error lista:\n${url}`
    );

    console.error(
      err.message
    );

    return [];
  }
}

// ─────────────────────────────
// LOAD EVERYTHING
// ─────────────────────────────

async function loadAllLists() {

  let allItems = [];

  for (const url of M3U_URLS) {

    const items =
      await loadList(url);

    allItems =
      allItems.concat(items);
  }

  console.log(
    `📦 TOTAL ITEMS: ${allItems.length}`
  );

  const grouped =
    groupContent(allItems);

  movies =
    grouped.movies;

  series =
    grouped.series;

  console.log(
    `✅ ${movies.length} películas`
  );

  console.log(
    `✅ ${Object.keys(series).length} series`
  );
}

// ─────────────────────────────
// TMDB SEARCH
// ─────────────────────────────

async function searchTMDB(
  title,
  type = "movie"
) {

  if (!TMDB_KEY) {
    return null;
  }

  const slug =
    slugify(title);

  if (cache[slug]) {

    return cache[slug];
  }

  try {

    const endpoint =
      type === "series"
        ? "tv"
        : "movie";

    const url =
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=es-MX`;

    const res =
      await fetch(url);

    const data =
      await res.json();

    if (
      !data.results ||
      !data.results.length
    ) {

      return null;
    }

    const first =
      data.results[0];

    const extRes =
      await fetch(
        `https://api.themoviedb.org/3/${endpoint}/${first.id}/external_ids?api_key=${TMDB_KEY}`
      );

    const ext =
      await extRes.json();

    if (!ext.imdb_id) {

      return null;
    }

    cache[slug] =
      ext.imdb_id;

    fs.writeFileSync(
      "cache.json",

      JSON.stringify(
        cache,
        null,
        2
      )
    );

    console.log(
      `💾 Cacheado: ${title}`
    );

    return ext.imdb_id;

  } catch {

    return null;
  }
}

// ─────────────────────────────
// MANIFEST
// ─────────────────────────────

const manifest = {

  id: "com.m3u.global",

  version: "2.0.0",

  name: "Mi Lista M3U",

  description:
    "M3U Multi Lista",

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

      name: "Mis Películas"
    },

    {
      type: "series",

      id: "m3u_series",

      name: "Mis Series"
    }
  ]
};

const builder =
  new addonBuilder(manifest);

// ─────────────────────────────
// CATALOG
// ─────────────────────────────

builder.defineCatalogHandler(
  ({ type, id }) => {

    if (
      type === "movie" &&
      id === "m3u_movies"
    ) {

      return Promise.resolve({

        metas:
          movies.map(m => ({

            id: m.id,

            type: "movie",

            name: m.title,

            poster:
              m.poster
          }))
      });
    }

    if (
      type === "series" &&
      id === "m3u_series"
    ) {

      return Promise.resolve({

        metas:
          Object.values(series)
            .map(s => ({

              id: s.id,

              type: "series",

              name: s.title,

              poster:
                s.poster
            }))
      });
    }

    return Promise.resolve({
      metas: []
    });
  }
);

// ─────────────────────────────
// STREAMS
// ─────────────────────────────

builder.defineStreamHandler(
  async ({ type, id }) => {

    // MOVIES
    if (type === "movie") {

      const movie =
        movies.find(
          m => m.id === id
        );

      if (!movie) {

        return {
          streams: []
        };
      }

      return {

        streams:

          movie.streams.map(s => ({

            url: s.url,

            title:
              s.language,

            name: "M3U"
          }))
      };
    }

    // SERIES
    if (type === "series") {

      const parts =
        id.split(":");

      const seriesId =
        parts[0];

      const season =
        parseInt(parts[1]);

      const episode =
        parseInt(parts[2]);

      const show =
        series[seriesId];

      if (!show) {

        return {
          streams: []
        };
      }

      const episodes =
        show.episodes.filter(
          e =>

            e.season === season &&

            e.episode === episode
        );

      return {

        streams:

          episodes.map(ep => ({

            url: ep.url,

            title:
              ep.language,

            name: "M3U"
          }))
      };
    }

    return {
      streams: []
    };
  }
);

// ─────────────────────────────
// META
// ─────────────────────────────

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

        meta: {

          id: movie.id,

          type: "movie",

          name: movie.title,

          poster:
            movie.poster
        }
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

      const videos =
        show.episodes.map(ep => ({

          id:
            `${id}:${ep.season}:${ep.episode}`,

          title:
            `S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`,

          season:
            ep.season,

          episode:
            ep.episode
        }));

      return Promise.resolve({

        meta: {

          id,

          type: "series",

          name:
            show.title,

          poster:
            show.poster,

          videos
        }
      });
    }

    return Promise.resolve({
      meta: null
    });
  }
);

// ─────────────────────────────
// START
// ─────────────────────────────

(async () => {

  await loadAllLists();

  serveHTTP(
    builder.getInterface(),
    { port: PORT }
  );

  console.log(
    `🚀 Addon puerto ${PORT}`
  );
})();
