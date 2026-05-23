/**
 * parse-m3u.js
 * Multi-stream + fallback automático
 */

const SERIES_KEYWORDS = [
  "serie",
  "series",
  "season",
  "temporada",
  "tv"
];

const SEASON_EP_RE =
  /[Ss](\d{1,2})[Ee](\d{1,2})/;

function slugify(str) {

  return str
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function parseM3U(raw) {

  const lines =
    raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

  const items = [];

  let current = null;

  for (const line of lines) {

    if (line.startsWith("#EXTINF")) {

      current =
        parseExtInf(line);

    } else if (
      !line.startsWith("#") &&
      current
    ) {

      current.url = line;

      items.push(current);

      current = null;
    }
  }

  return items;
}

function parseExtInf(line) {

  const titleMatch =
    line.match(/,(.+)$/);

  const title =
    titleMatch
      ? titleMatch[1].trim()
      : "Sin título";

  return {

    title,

    tvgName:
      extractAttr(line, "tvg-name") ||
      title,

    tvgId:
      extractAttr(line, "tvg-id") ||
      null,

    logo:
      extractAttr(line, "tvg-logo") ||
      null,

    group:
      extractAttr(line, "group-title") ||
      "",

    url: null
  };
}

function extractAttr(str, attr) {

  const re =
    new RegExp(`${attr}="([^"]*)"`, "i");

  const m = str.match(re);

  return m
    ? m[1].trim()
    : null;
}

function detectLanguage(str = "") {

  const t =
    str.toLowerCase();

  const langs = [];

  if (t.includes("latino")) {
    langs.push("🌎 Latino");
  }

  if (t.includes("castellano")) {
    langs.push("🇪🇸 Castellano");
  }

  if (
    t.includes("ingles") ||
    t.includes("english")
  ) {
    langs.push("🇺🇸 Inglés");
  }

  if (!langs.length) {
    langs.push("🌐 Multi");
  }

  return langs.join(" • ");
}

function groupContent(items) {

  const movies = {};
  const series = {};

  for (const item of items) {

    const seMatch =
      SEASON_EP_RE.exec(item.title);

    const isSeries =
      seMatch ||
      SERIES_KEYWORDS.some(
        kw =>
          item.group
            .toLowerCase()
            .includes(kw)
      );

    // SERIES
    if (isSeries && seMatch) {

      const season =
        parseInt(seMatch[1]);

      const episode =
        parseInt(seMatch[2]);

      const cleanName =
        item.title
          .replace(SEASON_EP_RE, "")
          .trim();

      const id =
        item.tvgId ||
        slugify(cleanName);

      if (!series[id]) {

        series[id] = {

          id,

          title: cleanName,

          poster: item.logo,

          episodes: []
        };
      }

      series[id].episodes.push({

        season,
        episode,

        url: item.url,

        language:
          detectLanguage(item.title)
      });

    } else {

      // MOVIES

      const id =
        item.tvgId ||
        slugify(item.title);

      if (!movies[id]) {

        movies[id] = {

          id,

          title: item.title,

          poster: item.logo,

          streams: []
        };
      }

      movies[id].streams.push({

        url: item.url,

        language:
          detectLanguage(item.title)
      });
    }
  }

  return {

    movies:
      Object.values(movies),

    series
  };
}

module.exports = {

  parseM3U,
  groupContent,
  slugify
};
