/**
 * parse-m3u.js
 * Parses an M3U playlist and groups items into movies and series.
 *
 * Supported M3U tags:
 *   #EXTINF:-1 tvg-name="..." tvg-logo="..." group-title="..." ,Title
 *
 * Series detection:
 *   - Filename or title contains  S##E##  (e.g. S01E03)
 *   - group-title contains "series", "serie", "show", "temporada"
 */

const SERIES_KEYWORDS = ["serie", "series", "show", "temporada", "season", "tv"];
const SEASON_EP_RE = /[Ss](\d{1,2})[Ee](\d{1,2})/;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 60);
}

/**
 * Parse a raw M3U string into an array of items.
 * @param {string} raw
 * @returns {{ title, url, logo, group, tvgName, tvgId }[]}
 */
function parseM3U(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      current = parseExtInf(line);
    } else if (line.startsWith("#")) {
      // skip other directives
    } else if (current) {
      current.url = line;
      items.push(current);
      current = null;
    }
  }

  return items;
}

function parseExtInf(line) {
  // Extract attributes from the tag
  const attrStr = line.replace(/#EXTINF:[^,]*,?/, "");
  const titleMatch = line.match(/,(.+)$/);
  const title = titleMatch ? titleMatch[1].trim() : "Sin título";

  const logo = extractAttr(line, "tvg-logo") || extractAttr(line, "tvg-logo-url") || null;
  const group = extractAttr(line, "group-title") || "";
  const tvgName = extractAttr(line, "tvg-name") || title;
  const tvgId = extractAttr(line, "tvg-id") || null;

  return { title, logo, group, tvgName, tvgId, url: null };
}

function extractAttr(str, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`, "i");
  const m = str.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Group parsed items into movies and series.
 * @param {object[]} items
 * @returns {{ movies: object[], series: object }}
 */
function groupContent(items) {
  const movies = [];
  const series = {};   // keyed by series slug id

  for (const item of items) {
    const seMatch = SEASON_EP_RE.exec(item.title) || SEASON_EP_RE.exec(item.tvgName);
    const groupLower = item.group.toLowerCase();
    const isSeries =
      seMatch ||
      SERIES_KEYWORDS.some(kw => groupLower.includes(kw));

    if (isSeries && seMatch) {
      // ── Series episode ────────────────────────────────────────────
      const season = parseInt(seMatch[1], 10);
      const episode = parseInt(seMatch[2], 10);
      // Clean series name: everything before S##E##
      const rawName = (item.tvgName || item.title).replace(SEASON_EP_RE, "").replace(/[-–_.\s]+$/, "").trim();
      const seriesId = slugify(rawName) || slugify(item.group) || "serie_desconocida";

      if (!series[seriesId]) {
        series[seriesId] = {
          id: seriesId,
          title: rawName || item.group,
          poster: item.logo || null,
          genres: item.group ? [item.group] : [],
          episodes: [],
        };
      }
      series[seriesId].episodes.push({
        season,
        episode,
        title: `S${pad(season)}E${pad(episode)} - ${item.title}`,
        url: item.url,
      });
    } else {
      // ── Movie ─────────────────────────────────────────────────────
      const movieId = slugify(item.tvgName || item.title) + "_" + Math.abs(hashCode(item.url));
      movies.push({
        id: movieId,
        title: item.tvgName || item.title,
        url: item.url,
        poster: item.logo || null,
        genres: item.group ? [item.group] : [],
      });
    }
  }

  // Sort series episodes
  for (const s of Object.values(series)) {
    s.episodes.sort((a, b) =>
      a.season !== b.season ? a.season - b.season : a.episode - b.episode
    );
  }

  return { movies, series };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

module.exports = { parseM3U, groupContent };
