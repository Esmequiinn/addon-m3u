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

const PORT =
  process.env.PORT || 7000;

const M3U_URL =
  process.env.M3U_URL;

const TMDB_KEY =
  process.env.TMDB_KEY;

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
// LOAD LIST
// ─────────────────────────────

async function loadList() {

  console.log(
    "📥 Descargando lista..."
  );

  const res =
    await fetch(M3U_URL);

  const raw =
    await res.text();

  const items =
    parseM3U(raw);

  const grouped =
    groupContent(items);

  movies =
    grouped.movies;

  series =
    grouped.series;

  console.log(
    `✅ ${movies.length} películas`
  );
}

// ─────────────────────────────
// TMDB SEARCH
// ─────────────────────────────

async function searchTMDB(
  title,
  type = "movie"
) {

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

    const external =
      await fetch(
        `https://api.themoviedb.org/3/${endpoint}/${first.id}/external_ids?api_key=${TMDB_KEY}`
      );

    const ext =
      await external.json();

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

  version: "1.0.0",

  name: "Mi Lista M3U",

  description:
    "M3U Global",

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
      type === "movie"
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
      type === "series"
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
          m =>
            m.id === id
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

      const [
        seriesId,
        season,
        episode
      ] = id.split(":");

      const show =
        series[seriesId];

      if (!show) {

        return {
          streams: []
        };
      }

      const eps =
        show.episodes.filter(
          e =>

            e.season ==
              season &&

            e.episode ==
              episode
        );

      return {

        streams:

          eps.map(ep => ({

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

(async () => {

  await loadList();

  serveHTTP(
    builder.getInterface(),
    { port: PORT }
  );

  console.log(
    `🚀 Puerto ${PORT}`
  );
})();
