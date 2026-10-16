// Roman Missal propers (entrance antiphon, collect, prayer over the offerings,
// communion antiphon, prayer after communion) in English and Latin from
// iBreviary's mobile site, matched to the Hong Kong formulary by antiphon
// citation. Written without access to the site: the fetcher discovers the
// Missal section links from the index page and logs them, and dumps the first
// page it parses, so the slugs and heading names can be corrected from the log.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeEntities, htmlToLines, titleOf } from "./html.mjs";
import { PoliteFetcher } from "./polite.mjs";
import { parseUsCitation } from "./lectionary.mjs";

export const BASE = "https://www.ibreviary.com/m2/";
const DATE_PARAMS = ["date", "data", "giorno"];
const DATE_FORMATS = [(y, m, d) => `${y}${m}${d}`, (y, m, d) => `${y}-${m}-${d}`, (y, m, d) => `${d}/${m}/${y}`];
// Slugs to try when the index page gives no usable link.
const SECTION_GUESSES = ["antifone_e_orazioni", "antifone", "orazioni", "messa_del_giorno", "messa", "proprio", "propri"];

export const KIND_OF_HEADING = [
  ["entrance", /^(entrance antiphon|antiphona ad introitum|ad introitum|introit)/i],
  ["collect", /^(collect|collecta|oratio collecta|opening prayer)/i],
  ["offertory", /^(prayer over the (offerings|gifts)|super oblata|oratio super oblata)/i],
  ["preface", /^(preface|praefatio)/i],
  ["communion", /^(communion antiphon|antiphona ad communionem|ad communionem)/i],
  ["postcommunion", /^(prayer after communion|post communionem|oratio post communionem)/i],
  ["over_people", /^(prayer over the people|super populum|oratio super populum|solemn blessing)/i],
];
const KIND_RE = new RegExp(KIND_OF_HEADING.map(([, re]) => `(?:${re.source})`).join("|"), "i");
const NOISE = /^(today|oggi|home|menu|back|indietro|options|opzioni|calendar|calendario|share|condividi|www\.|©|copyright|ibreviary|font|print|stampa|settings)/i;
const CITE_LINE = /^(?:cf\.?\s*)?(?:[1-3]\s?)?[A-Z][a-z]{0,4}\.?\s*\d+\s*(?:\(\d+\))?\s*[:,]\s*\d/i;

function ymd(iso) { const [y, m, d] = iso.split("-"); return [y, m, d]; }

/** Group a flat list of heading/text lines into Missal blocks. */
export function parseMissalHtml(html) {
  const lines = htmlToLines(html).filter((l) => !NOISE.test(l));
  const blocks = [];
  const title = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const km = KIND_OF_HEADING.find(([, re]) => re.test(line) && line.length < 60);
    if (km) { cur = { kind: km[0], heading: line, citation: null, lines: [] }; blocks.push(cur); continue; }
    if (!cur) { if (line.length <= 90) title.push(line); continue; }
    // Citation: on its own line ("Ps 130 (129):3-4", "Cf. Mt 25:34") or trailing in parentheses.
    if (!cur.citation && CITE_LINE.test(line) && line.length < 40) { cur.citation = cleanCite(line); continue; }
    const tail = /^(.*?)\s*[（(]\s*((?:cf\.?\s*)?(?:[1-3]\s?)?[A-Z][a-z]{0,4}\.?\s*\d+\s*(?:\(\d+\))?\s*[:,]\s*[\d\s,.\-–ab;]+)[)）]\s*$/i.exec(line);
    if (tail && !cur.citation) { cur.citation = cleanCite(tail[2]); if (tail[1]) cur.lines.push(tail[1]); continue; }
    cur.lines.push(line);
  }
  return { title: title.slice(0, 6), blocks };
}
function cleanCite(s) { return s.replace(/\s+/g, " ").replace(/^cf\.?\s*/i, "").trim(); }

/** Group blocks into formularies: a repeated kind starts a new set. */
export function groupSets(blocks) {
  const sets = [];
  let cur = null;
  for (const b of blocks) {
    if (!cur || cur.some((x) => x.kind === b.kind)) { cur = []; sets.push(cur); }
    cur.push(b);
  }
  return sets;
}

/**
 * Compare a HK antiphon citation (parsed by citation.mjs, Hebrew psalm numbering)
 * with an iBreviary one such as "Ps 130 (129):3-4" / "Ps 129, 3-4" / "Mt 25:34".
 */
export function antiphonMatches(hk, ibCite) {
  if (!hk || !ibCite) return false;
  const norm = ibCite.replace(/\((\d+)\)/, "").replace(/,\s*(?=\d)/, ":").replace(/\s+/g, " ").trim();
  const us = parseUsCitation(norm) || parseUsCitation(norm.replace(/^(\w+)\.?\s/, "$1 "));
  if (!us || us.book !== hk.book) return false;
  const hkKeys = new Set(hk.verses.filter((x) => !x.to).map((x) => `${x.c}:${x.v}`));
  let inter = 0;
  for (const k of hkKeys) if (us.verses.has(k)) inter++;
  if (inter) return true;
  if (hk.book === "PSA") {
    // Latin/Vulgate numbering is one lower for most psalms.
    const shifted = new Set([...us.verses].map((k) => { const [c, v] = k.split(":").map(Number); return `${c + 1}:${v}`; }));
    for (const k of hkKeys) if (shifted.has(k)) return true;
  }
  return false;
}

export class IBreviary {
  constructor({ cacheDir = "cache/ibreviary", fetcher, log = console } = {}) {
    this.cacheDir = cacheDir; this.log = log;
    this.fetcher = fetcher ?? new PoliteFetcher({ delayMs: 2500, log });
    this.mem = new Map(); this.fetched = 0; this.failed = []; this.dumped = false;
    this.discovery = this.loadDiscovery();
  }
  loadDiscovery() {
    const p = join(this.cacheDir, "discovery.json");
    try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
  }
  saveDiscovery() { mkdirSync(this.cacheDir, { recursive: true }); writeFileSync(join(this.cacheDir, "discovery.json"), JSON.stringify(this.discovery)); }

  dateQuery(iso) {
    const [y, m, d] = ymd(iso);
    const p = this.discovery.dateParam ?? DATE_PARAMS[0];
    const f = DATE_FORMATS[this.discovery.dateFormat ?? 0];
    return `${p}=${encodeURIComponent(f(y, m, d))}`;
  }

  /** Find the "antiphons and prayers" section slug from the Missal index page once. */
  async discoverSection(iso, lang) {
    if (this.discovery.section) return this.discovery.section;
    const url = `${BASE}messale.php?lang=${lang}&${this.dateQuery(iso)}`;
    const { html } = await this.fetcher.get(url);
    if (!html) return null;
    const links = [...html.matchAll(/<a[^>]*href="([^"]*messale\.php[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({ href: decodeEntities(m[1]), text: decodeEntities(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() }));
    this.log.log(`iBreviary index links (${url}):`);
    for (const l of links) this.log.log(`  ${l.text}  ->  ${l.href}`);
    const pick = links.find((l) => /antif|antiphon|orazion|prayer|oratio|proprio|proper/i.test(l.text + " " + l.href));
    if (pick) {
      const sm = /[?&]s=([^&]+)/.exec(pick.href);
      if (sm) { this.discovery.section = sm[1]; this.saveDiscovery(); return sm[1]; }
    }
    return null;
  }

  async page(iso, lang) {
    const key = `${iso}/${lang}`;
    if (this.mem.has(key)) return this.mem.get(key);
    const path = join(this.cacheDir, lang, `${iso}.json`);
    let html = null, url = null;
    if (existsSync(path)) ({ html, url } = JSON.parse(readFileSync(path, "utf8")));
    if (html == null) {
      const section = await this.discoverSection(iso, lang);
      const slugs = [...(section ? [section] : []), ...SECTION_GUESSES.filter((s) => s !== section)];
      for (const s of slugs) {
        const u = `${BASE}messale.php?s=${s}&lang=${lang}&${this.dateQuery(iso)}`;
        const r = await this.fetcher.get(u);
        if (!r.html) continue;
        const parsed = parseMissalHtml(r.html);
        if (parsed.blocks.length) { html = r.html; url = u; this.fetched++; break; }
        if (!this.dumped) {
          this.dumped = true;
          this.log.warn(`! iBreviary page fetched but no Missal headings recognised: ${u}; title="${titleOf(r.html)}"; first lines:`);
          for (const l of htmlToLines(r.html).slice(0, 80)) this.log.warn("  | " + l);
        }
      }
      if (html == null) { this.failed.push(`${key}: no usable Missal page`); this.mem.set(key, null); return null; }
      mkdirSync(join(this.cacheDir, lang), { recursive: true });
      writeFileSync(path, JSON.stringify({ date: iso, lang, url, fetched: new Date().toISOString(), html }));
    }
    const parsed = parseMissalHtml(html);
    const out = { url, title: parsed.title, sets: groupSets(parsed.blocks) };
    this.mem.set(key, out);
    return out;
  }

  /**
   * Find the iBreviary formulary matching a HK set by its antiphon citations.
   * @returns {Promise<{en: object[]|null, la: object[]|null, title: string|null}>}
   */
  async match(iso, { entrance, communion }) {
    const en = await this.page(iso, "en");
    if (!en) return { en: null, la: null, title: null };
    const score = (set) => {
      const e = set.find((b) => b.kind === "entrance"), c = set.find((b) => b.kind === "communion");
      let s = 0;
      if (entrance && e && antiphonMatches(entrance, e.citation)) s += 2;
      if (communion && c && antiphonMatches(communion, c.citation)) s += 1;
      return s;
    };
    let best = null, bestScore = 0;
    en.sets.forEach((set, i) => { const s = score(set); if (s > bestScore) { best = i; bestScore = s; } });
    if (best == null) return { en: null, la: null, title: en.title[0] ?? null };
    const la = await this.page(iso, "la");
    return { en: en.sets[best], la: la?.sets[best] ?? la?.sets[0] ?? null, title: en.title[0] ?? null };
  }
}
