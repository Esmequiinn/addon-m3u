/**
 * parse-m3u.js
 * Multi-stream + idiomas + calidad
 */

const SERIES_KEYWORDS = [
  "serie",
  "series",
  "show",
  "temporada",
  "season",
  "tv"
];

const SEASON_EP_RE =
  /[Ss](\d{1,2})[Ee](\d{1,2})/;

// ─────────────────────────────────────────────

function slugify(str) {

  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 60);
}

// ─────────────────────────────────────────────

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

      current = parseExtInf(line);

    } else if (line.startsWith("#")) {

      continue;

    } else if (current) {

      current.url = line;

      items.push(current);

      current = null;
    }
  }

  return items;
}

// ─────────────────────────────────────────────

function parseExtInf(line) {

  const titleMatch =
    line.match(/,(.+)$/);

  const title =
    titleMatch
      ? titleMatch[1].trim()
      : "Sin título";

  const logo =
    extractAttr(line, "tvg-logo") ||
    extractAttr(line, "tvg-logo-url") ||
    null;

  const group =
    extractAttr(line, "group-title") ||
    "";

  const tvgName =
    extractAttr(line, "tvg-name") ||
    title;

  const tvgId =
    extractAttr(line, "tvg-id") ||
    null;

  return {

    title,
    logo,
    group,
    tvgName,
    tvgId,
    url: null
  };
}

// ─────────────────────────────────────────────

function extractAttr(str, attr) {

  const re =
    new RegExp(`${attr}="([^"]*)"`, "i");

  const m =
    str.match(re);

  return m
    ? m[1].trim()
    : null;
}

// ─────────────────────────────────────────────

function detectLanguage(str = "") {

  const t =
    str.toLowerCase();

  if (t.includes("latino")) {
    return "🌎 Latino";
  }

  if (t.includes("castellano")) {
    return "🇪🇸 Castellano";
  }

  if (
    t.includes("english") ||
    t.includes("ingles")
  ) {
    return "🇺🇸 Inglés";
  }

  return "🌐 Multi";
}

// ─────────────────────────────────────────────

function detectQuality(str = "") {

  const t =
    str.toLowerCase();

  if (
    t.includes("2160") ||
    t.includes("4k")
  ) {
    return "📺 4K";
  }

  if (t.includes("1080")) {
    return "📺 1080p";
  }

  if (t.includes("720")) {
    return "📺 720p";
  }

  return "📺 HD";
}

// ─────────────────────────────────────────────

function groupContent(items) {

  const moviesMap = {};

  const series = {};

  for (const item of items) {

    const seMatch =
      SEASON_EP_RE.exec(item.title) ||
      SEASON_EP_RE.exec(item.tvgName);

    const groupLower =
      item.group.toLowerCase();

    const isSeries =
      seMatch ||
      SERIES_KEYWORDS.some(
        kw => groupLower.includes(kw)
      );

    // ─────────────────────────────────────────
    // SERIES
    // ─────────────────────────────────────────

    if (isSeries && seMatch) {

      const season =
        parseInt(seMatch[1], 10);

      const episode =
        parseInt(seMatch[2], 10);

      const rawName =
        (item.tvgName || item.title)
          .replace(SEASON_EP_RE, "")
          .replace(/[-–_.\s]+$/, "")
          .trim();

      const seriesId =
        item.tvgId &&
        item.tvgId.startsWith("tt")

          ? item.tvgId

          : slugify(rawName);

      if (!series[seriesId]) {

        series[seriesId] = {

          id: seriesId,

          title: rawName,

          poster: item.logo || null,

          genres:
            item.group
              ? [item.group]
              : [],

          episodes: []
        };
      }

      series[seriesId].episodes.push({

        season,
        episode,

        title:
          `S${pad(season)}E${pad(episode)}`,

        url: item.url,

        language:
          detectLanguage(item.title),

        quality:
          detectQuality(item.title)
      });

    } else {

      // ───────────────────────────────────────
      // MOVIES
      // ───────────────────────────────────────

      const movieId =

        item.tvgId &&
        item.tvgId.startsWith("tt")

          ? item.tvgId

          : slugify(item.tvgName || item.title);

      if (!moviesMap[movieId]) {

        moviesMap[movieId] = {

          id: movieId,

          title:
            item.tvgName || item.title,

          poster:
            item.logo || null,

          genres:
            item.group
              ? [item.group]
              : [],

          streams: []
        };
      }

      moviesMap[movieId]
        .streams
        .push({

          url: item.url,

          language:
            detectLanguage(item.title),

          quality:
            detectQuality(item.title)
        });
    }
  }

  return {

    movies:
      Object.values(moviesMap),

    series
  };
}

// ─────────────────────────────────────────────

function pad(n) {

  return String(n).padStart(2, "0");
}

module.exports = {

  parseM3U,

  groupContent
};
