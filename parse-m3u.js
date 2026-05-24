/**
 * parse-m3u.js
 * Detecta películas/series
 * Ignora canales IPTV
 * Compatible con:
 * S01E01
 * S01 E01
 * 1x01
 * 01x01
 */

const SERIES_KEYWORDS = [
  "serie",
  "series",
  "show",
  "temporada",
  "season",
  "tv"
];

// ✅ AHORA SOPORTA:
// S01E01
// S01 E01
// 1x01
// 01x01
const SEASON_EP_RE =
  /(?:[Ss](\d{1,2})\s*[Ee](\d{1,2}))|(?:(\d{1,2})x(\d{1,2}))/i;

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

  const tvgLanguage =
    extractAttr(line, "tvg-language") ||
    null;

  return {

    title,
    logo,
    group,
    tvgName,
    tvgId,
    tvgLanguage,
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
// LIMPIAR TÍTULOS
// ─────────────────────────────────────────────

function cleanTitle(str = "") {

  return str

    .replace(/tvg-[a-z-]+=\"[^"]*\"/gi, "")

    .replace(/group-title=\"[^"]*\"/gi, "")

    .replace(/[A-Za-z-]+=\"[^"]*\"/gi, "")

    .replace(
      /1080p|720p|2160p|4k|hdr|webrip|bluray|x264|x265/gi,
      ""
    )

    .replace(
      /latino|castellano|dual|subtitulado|sub/gi,
      ""
    )

    .replace(/\s+/g, " ")

    .trim();
}

// ─────────────────────────────────────────────
// IGNORAR CANALES IPTV
// ─────────────────────────────────────────────

function isLiveChannel(item) {

  const all =
    `${item.title} ${item.group} ${item.tvgName}`
      .toLowerCase();

  // grupos típicos de TV
  const CHANNEL_GROUPS = [

    "tv en vivo",
    "live tv",
    "channels",
    "canales",
    "deportes",
    "sports",
    "noticias",
    "news",
    "adult",
    "xxx",
    "music",
    "radio",
    "documentales",
    "24/7"
  ];

  // nombres típicos de canales
  const CHANNEL_NAMES = [

    "hbo",
    "espn",
    "fox",
    "cnn",
    "disney channel",
    "cartoon network",
    "nickelodeon",
    "mtv",
    "discovery",
    "natgeo",
    "tnt",
    "warner",
    "cinecanal",
    "canal",
    "tv"
  ];

  // stream TS típico IPTV
  const isTS =
    item.url?.includes(".ts");

  // grupo IPTV
  const hasGroup =
    CHANNEL_GROUPS.some(
      g => all.includes(g)
    );

  // nombre IPTV
  const hasChannelName =
    CHANNEL_NAMES.some(
      c => all.includes(c)
    );

  return (
    hasGroup ||
    hasChannelName ||
    isTS
  );
}

// ─────────────────────────────────────────────
// DETECTAR IDIOMAS
// ─────────────────────────────────────────────

function detectLanguage(
  title = "",
  tvgName = "",
  group = "",
  tvgLanguage = ""
) {

  const all =
    `${title} ${tvgName} ${group} ${tvgLanguage}`
      .toLowerCase();

  const langs = [];

  if (
    /\blatin[oa]?\b/.test(all) ||
    /\blat\b/.test(all)
  ) {
    langs.push("🌎 Latino");
  }

  if (
    /\bcastellano\b/.test(all) ||
    /\bespan[oó]l\b/.test(all) ||
    /\besp\b/.test(all)
  ) {
    langs.push("🇪🇸 Castellano");
  }

  if (
    /\benglish\b/.test(all) ||
    /\bingl[eé]s\b/.test(all) ||
    /\beng\b/.test(all)
  ) {
    langs.push("🇺🇸 Inglés");
  }

  if (
    /\bmulti\b/.test(all) ||
    /\bdual\b/.test(all)
  ) {
    langs.push("🌐 Multi");
  }

  if (!langs.length) {
    return "🎬 Stream";
  }

  return langs.join(" • ");
}

// ─────────────────────────────────────────────
// GROUP CONTENT
// ─────────────────────────────────────────────

function groupContent(items) {

  const moviesMap = {};

  const series = {};

  for (const item of items) {

    // ✅ IGNORAR CANALES
    if (isLiveChannel(item)) {
      continue;
    }

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

      // ✅ SOPORTA S01E01 y 1x01
      const season =
        parseInt(
          seMatch[1] || seMatch[3],
          10
        );

      const episode =
        parseInt(
          seMatch[2] || seMatch[4],
          10
        );

      const rawName =
        cleanTitle(
          (item.tvgName || item.title)
            .replace(SEASON_EP_RE, "")
            .replace(/[-–_.\s]+$/, "")
            .trim()
        );

      const seriesId =

        item.tvgId &&
        item.tvgId.startsWith("tt")

          ? item.tvgId

          : slugify(rawName);

      if (!series[seriesId]) {

        series[seriesId] = {

          id: seriesId,

          title: rawName,

          poster:
            item.logo || null,

          genres:
            item.group
              ? [item.group]
              : [],

          episodes: []
        };
      }

      const lang =
        detectLanguage(
          item.title,
          item.tvgName,
          item.group,
          item.tvgLanguage
        );

      series[seriesId]
        .episodes
        .push({

          season,

          episode,

          title:
            `S${pad(season)}E${pad(episode)}`,

          url: item.url,

          language: lang
        });

    } else {

      // ───────────────────────────────────────
      // MOVIES
      // ───────────────────────────────────────

      const movieId =

        item.tvgId &&
        item.tvgId.startsWith("tt")

          ? item.tvgId

          : slugify(
              cleanTitle(
                item.tvgName || item.title
              )
            );

      if (!moviesMap[movieId]) {

        moviesMap[movieId] = {

          id: movieId,

          title:
            cleanTitle(
              item.tvgName || item.title
            ),

          poster:
            item.logo || null,

          genres:
            item.group
              ? [item.group]
              : [],

          streams: []
        };
      }

      const lang =
        detectLanguage(
          item.title,
          item.tvgName,
          item.group,
          item.tvgLanguage
        );

      moviesMap[movieId]
        .streams
        .push({

          url: item.url,

          language: lang
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