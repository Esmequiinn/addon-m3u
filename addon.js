const { addonBuilder, serveHTTP } =
  require("stremio-addon-sdk");

const fs = require("fs");

// ─────────────────────────────────────────────

const {
  parseM3U,
  groupContent
} = require("./parse-m3u");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const PORT =
  process.env.PORT || 7000;

const TMDB_API_KEY =
  process.env.TMDB_API_KEY;

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
    "❌ No configuraste M3U_URL"
  );

  process.exit(1);
}

// ─────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────

const CACHE_FILE =
  "./tmdb-cache.json";

let cache = {};

if (fs.existsSync(CACHE_FILE)) {

  try {

    cache =
      JSON.parse(
        fs.readFileSync(
          CACHE_FILE,
          "utf8"
        )
      );

  } catch {

    cache = {};
  }
}

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────

let movies = [];

let series = {};

// ─────────────────────────────────────────────
// NORMALIZE
// ─────────────────────────────────────────────

function normalize(str = "") {

  return str
    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(
      /\b(19|20)\d{2}\b/g,
      ""
    )

    .replace(
      /1080p|720p|2160p|4k|hdr|webrip|bluray|x264|x265/gi,
      ""
    )

    .replace(
      /latino|castellano|dual|subtitulado|sub/gi,
      ""
    )

    .replace(
      /s\d{1,2}e\d{1,2}/gi,
      ""
    )

    .replace(/[^a-z0-9]/g, " ")

    .replace(/\s+/g, " ")

    .trim();
}

// ─────────────────────────────────────────────
// TMDB SEARCH
// ─────────────────────────────────────────────

async function searchTMDB(
  title,
  type
) {

  if (!TMDB_API_KEY) {
    return null;
  }

  const clean =
    normalize(title);

  // cache
  if (cache[clean]) {

    return cache[clean];
  }

  try {

    console.log(
      `🔎 TMDB: ${clean}`
    );

    const endpoint =
      type === "series"
        ? "tv"
        : "movie";

    const url =
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&language=es-MX`;

    const response =
      await fetch(url);

    const data =
      await response.json();

    if (
      !data.results ||
      !data.results.length
    ) {

      return null;
    }

    const first =
      data.results[0];

    const detailsUrl =
      `https://api.themoviedb.org/3/${endpoint}/${first.id}/external_ids?api_key=${TMDB_API_KEY}`;

    const detailsResponse =
      await fetch(detailsUrl);

    const details =
      await detailsResponse.json();

    if (!details.imdb_id) {

      return null;
    }

    cache[clean] =
      details.imdb_id;

    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(
        cache,
        null,
        2
      )
    );

    console.log(
      `✅ Cacheado: ${clean} → ${details.imdb_id}`
    );

    return details.imdb_id;

  } catch (err) {

    console.log(
      `❌ TMDB error: ${title}`
    );

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

      console.log(
        `📥 Descargando: ${url}`
      );

      const response =
        await fetch(url);

      if (!response.ok) {

        console.log(
          `❌ HTTP ${response.status}`
        );

        continue;
      }

      const raw =
        await response.text();

      const items =
        parseM3U(raw);

      console.log(
        `📺 ${items.length} items`
      );

      allItems.push(...items);
    }

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

  } catch (err) {

    console.error(err);
  }
}

// ─────────────────────────────────────────────
// MANIFEST
// ─────────────────────────────────────────────

const manifest = {

  id: "com.esmequinn.m3u",

  version: "3.0.0",

  name: "M3U",

  description:
    "M3U IPTV Addon",

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

// ─────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────

builder.defineCatalogHandler(
  async ({ type, id }) => {

    if (
      type === "movie" &&
      id === "m3u_movies"
    ) {

      return {

        metas:
          movies.map(movieToMeta)
      };
    }

    if (
      type === "series" &&
      id === "m3u_series"
    ) {

      return {

        metas:
          Object.values(series)
            .map(seriesToMeta)
      };
    }

    return { metas: [] };
  }
);

// ─────────────────────────────────────────────
// META
// ─────────────────────────────────────────────

builder.defineMetaHandler(
  async ({ type, id }) => {

    if (type === "movie") {

      let movie =
        movies.find(
          m => m.id === id
        );

      // fallback TMDB
      if (!movie) {

        const found =
          movies.find(
            m =>
              normalize(m.title) ===
              normalize(id)
          );

        if (found) {
          movie = found;
        }
      }

      if (!movie) {

        return { meta: null };
      }

      // buscar imdb automático
      if (
        !movie.id.startsWith("tt")
      ) {

        const imdb =
          await searchTMDB(
            movie.title,
            "movie"
          );

        if (imdb) {

          movie.id = imdb;
        }
      }

      return {

        meta:
          movieToFullMeta(movie)
      };
    }

    if (type === "series") {

      let show =
        series[id];

      if (!show) {

        show =
          Object.values(series)
            .find(
              s =>
                normalize(s.title) ===
                normalize(id)
            );
      }

      if (!show) {

        return { meta: null };
      }

      // imdb automático
      if (
        !show.id.startsWith("tt")
      ) {

        const imdb =
          await searchTMDB(
            show.title,
            "series"
          );

        if (imdb) {

          show.id = imdb;
        }
      }

      return {

        meta:
          seriesToFullMeta(
            show,
            show.id
          )
      };
    }

    return { meta: null };
  }
);

// ─────────────────────────────────────────────
// STREAMS
// ─────────────────────────────────────────────

builder.defineStreamHandler(
  async ({ type, id }) => {

    // MOVIES
    if (type === "movie") {

      let movie =
        movies.find(
          m => m.id === id
        );

      if (!movie) {

        movie =
          movies.find(
            m =>
              normalize(m.title) ===
              normalize(id)
          );
      }

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
              `${s.language}`,

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
        parseInt(parts[1], 10);

      const episode =
        parseInt(parts[2], 10);

      let show =
        series[seriesId];

      if (!show) {

        show =
          Object.values(series)
            .find(
              s =>
                normalize(s.title) ===
                normalize(seriesId)
            );
      }

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
              `${ep.language}`,

            name: "M3U"
          }))
      };
    }

    return {
      streams: []
    };
  }
);

// ─────────────────────────────────────────────

function movieToMeta(m) {

  return {

    id: m.id,

    type: "movie",

    name: m.title,

    poster: m.poster
  };
}

function movieToFullMeta(m) {

  return {

    ...movieToMeta(m),

    description:
      "Película M3U"
  };
}

function seriesToMeta(s) {

  return {

    id: s.id,

    type: "series",

    name: s.title,

    poster: s.poster
  };
}

function seriesToFullMeta(s, id) {

  return {

    id,

    type: "series",

    name: s.title,

    poster: s.poster,

    videos:

      s.episodes.map(ep => ({

        id:
          `${id}:${ep.season}:${ep.episode}`,

        title:
          ep.title,

        season:
          ep.season,

        number:
          ep.episode
      }))
  };
}

// ─────────────────────────────────────────────

(async () => {

  await loadList();

  serveHTTP(
    builder.getInterface(),
    { port: PORT }
  );

  console.log(
    `🚀 Addon corriendo en ${PORT}`
  );
})();