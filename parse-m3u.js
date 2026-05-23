/**
 * parse-m3u.js
 * Multi-stream + idiomas mejorado
 */

const SERIES_KEYWORDS = [
  "serie",
  "series",
  "show",
  "temporada",
  "season",
  "tv"
];

const SEASON_EP_RE = /[Ss](\d{1,2})[Ee](\d{1,2})/;

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
  const lines = raw
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
  const titleMatch = line.match(/,(.+)$/);
  const title = titleMatch ? titleMatch[1].trim() : "Sin título";

  const logo =
    extractAttr(line, "tvg-logo") ||
    extractAttr(line, "tvg-logo-url") ||
    null;

  const group = extractAttr(line, "group-title") || "";
  const tvgName = extractAttr(line, "tvg-name") || title;
  const tvgId = extractAttr(line, "tvg-id") || null;

  // ✅ También extraemos tvg-language si viene en la línea
  const tvgLanguage = extractAttr(line, "tvg-language") || null;

  return { title, logo, group, tvgName, tvgId, tvgLanguage, url: null };
}

// ─────────────────────────────────────────────
function extractAttr(str, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`, "i");
  const m = str.match(re);
  return m ? m[1].trim() : null;
}

// ─────────────────────────────────────────────
// ✅ detectLanguage mejorado
// Recibe todos los campos disponibles para tener más contexto
// Detecta abreviaciones, corchetes, paréntesis, guiones y códigos de idioma
// ─────────────────────────────────────────────
function detectLanguage(title = "", tvgName = "", group = "", tvgLanguage = "") {
  // Unir todo en un solo string para buscar en cualquier campo
  const all = `${title} ${tvgName} ${group} ${tvgLanguage}`.toLowerCase();

  // ── LATINO ──────────────────────────────────
  // Patrones: latino, lat, [lat], (lat), - lat, latam, spa-419
  const isLatino =
    /\blatin[oa]?\b/.test(all) ||
    /\blat\b/.test(all) ||
    /\[lat\]/.test(all) ||
    /\(lat\)/.test(all) ||
    /\blatam\b/.test(all) ||
    /spa.?419/.test(all) ||
    /\bes.?la\b/.test(all);

  // ── CASTELLANO / ESPAÑOL ────────────────────
  // Patrones: castellano, español, esp, spa, [esp], (esp), - esp, es-es
  const isCastellano =
    /\bcastellano\b/.test(all) ||
    /\bespan[oó]l\b/.test(all) ||
    /\besp\b/.test(all) ||
    /\[esp\]/.test(all) ||
    /\(esp\)/.test(all) ||
    /\bspa\b/.test(all) ||
    /\bes\.es\b/.test(all) ||
    /\bes-es\b/.test(all);

  // ── INGLÉS ──────────────────────────────────
  // Patrones: english, inglés, ingles, eng, [eng], (eng), - eng
  const isIngles =
    /\benglish\b/.test(all) ||
    /\bingl[eé]s\b/.test(all) ||
    /\beng\b/.test(all) ||
    /\[eng\]/.test(all) ||
    /\(eng\)/.test(all) ||
    /\ben\b/.test(all) && !/\bgen\b/.test(all) && !/\bben\b/.test(all);

  // ── PORTUGUÉS ───────────────────────────────
  const isPortugues =
    /\bportugu[eé]s\b/.test(all) ||
    /\bport\b/.test(all) ||
    /\bpor\b/.test(all) ||
    /\[por\]/.test(all) ||
    /\(por\)/.test(all) ||
    /\bpt\b/.test(all) ||
    /\bbr\b/.test(all);

  // ── FRANCÉS ─────────────────────────────────
  const isFrances =
    /\bfranc[eé]s\b/.test(all) ||
    /\bfre\b/.test(all) ||
    /\bfra\b/.test(all) ||
    /\[fra\]/.test(all);

  // ── MULTI / DUAL ────────────────────────────
  const isMulti =
    /\bmulti\b/.test(all) ||
    /\bdual\b/.test(all) ||
    /\bmul\b/.test(all) ||
    /\[mul\]/.test(all) ||
    /\(mul\)/.test(all);

  // Construir resultado con los idiomas encontrados
  const langs = [];
  if (isLatino)    langs.push("🌎 Latino");
  if (isCastellano) langs.push("🇪🇸 Castellano");
  if (isIngles)    langs.push("🇺🇸 Inglés");
  if (isPortugues) langs.push("🇧🇷 Portugués");
  if (isFrances)   langs.push("🇫🇷 Francés");
  if (isMulti)     langs.push("🌐 Multi");

  // ✅ Si no se detectó nada, no asumir "Multi" —
  // devolver vacío para que en addon.js se muestre el título original
  if (langs.length === 0) return null;

  return langs.join(" • ");
}

// ─────────────────────────────────────────────
function groupContent(items) {
  const moviesMap = {};
  const series = {};

  for (const item of items) {
    const seMatch =
      SEASON_EP_RE.exec(item.title) ||
      SEASON_EP_RE.exec(item.tvgName);

    const groupLower = item.group.toLowerCase();

    const isSeries =
      seMatch ||
      SERIES_KEYWORDS.some(kw => groupLower.includes(kw));

    // ─────────────────────────────────────────
    // SERIES
    // ─────────────────────────────────────────
    if (isSeries && seMatch) {
      const season  = parseInt(seMatch[1], 10);
      const episode = parseInt(seMatch[2], 10);

      const rawName = (item.tvgName || item.title)
        .replace(SEASON_EP_RE, "")
        .replace(/[-–_.\s]+$/, "")
        .trim();

      const seriesId =
        item.tvgId && item.tvgId.startsWith("tt")
          ? item.tvgId
          : slugify(rawName);

      if (!series[seriesId]) {
        series[seriesId] = {
          id: seriesId,
          title: rawName,
          poster: item.logo || null,
          genres: item.group ? [item.group] : [],
          episodes: []
        };
      }

      // ✅ Pasar todos los campos a detectLanguage
      const lang =
        detectLanguage(item.title, item.tvgName, item.group, item.tvgLanguage || "") ||
        item.title; // si no detecta nada, usar el título completo como etiqueta

      series[seriesId].episodes.push({
        season,
        episode,
        title: `S${pad(season)}E${pad(episode)}`,
        url: item.url,
        language: lang
      });

    } else {
      // ───────────────────────────────────────
      // MOVIES
      // ───────────────────────────────────────
      const movieId =
        item.tvgId && item.tvgId.startsWith("tt")
          ? item.tvgId
          : slugify(item.tvgName || item.title);

      if (!moviesMap[movieId]) {
        moviesMap[movieId] = {
          id: movieId,
          title: item.tvgName || item.title,
          poster: item.logo || null,
          genres: item.group ? [item.group] : [],
          streams: []
        };
      }

      // ✅ Pasar todos los campos a detectLanguage
      const lang =
        detectLanguage(item.title, item.tvgName, item.group, item.tvgLanguage || "") ||
        item.title; // si no detecta nada, usar el título completo como etiqueta

      moviesMap[movieId].streams.push({
        url: item.url,
        language: lang
      });
    }
  }

  return {
    movies: Object.values(moviesMap),
    series
  };
}

// ─────────────────────────────────────────────
function pad(n) {
  return String(n).padStart(2, "0");
}

module.exports = { parseM3U, groupContent };