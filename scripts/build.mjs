#!/usr/bin/env node
// Build the static site into dist/:
//   dist/index.html, app.js, style.css, sw.js, manifest.json  (copied from site/)
//   dist/data/YYYY-MM-DD.json                                  (one per day in the window)
//   dist/data/index.json                                       (list of available dates)
//
// Usage:
//   node scripts/build.mjs                         # rolling window around today (HKT)
//   node scripts/build.mjs --dates 2026-10-16,...  # specific dates
//   node scripts/build.mjs --fixture file.htm      # parse a local file instead of fetching
//   node scripts/build.mjs --dump                  # print extracted text lines for debugging
//   node scripts/build.mjs --no-english            # skip NABRE fetching (offline tests)
//   env WINDOW_BACK=3 WINDOW_AHEAD=14
import { mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fetchDlc, parseDlcHtml, dlcUrl } from "./lib/dlc.mjs";
import { makeRomanizer } from "./lib/yale.mjs";
import { Nabre } from "./lib/nabre.mjs";
import { htmlToLines, decodeHtml } from "./lib/html.mjs";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const has = (name) => args.includes(name);

const OUT = "dist";
const DATA = join(OUT, "data");
mkdirSync(DATA, { recursive: true });

function hkToday() {
  return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dates = opt("--dates")
  ? opt("--dates").split(",").map((s) => s.trim()).filter(Boolean)
  : (() => {
      const back = Number(process.env.WINDOW_BACK ?? 3);
      const ahead = Number(process.env.WINDOW_AHEAD ?? 14);
      const today = hkToday();
      const out = [];
      for (let i = -back; i <= ahead; i++) out.push(addDays(today, i));
      return out;
    })();

const overrides = Object.fromEntries(Object.entries(existsSync("overrides.json") ? JSON.parse(readFileSync("overrides.json", "utf8")) : {}).filter(([k]) => !k.startsWith("_")));
const romanize = makeRomanizer(overrides);
const nabre = has("--no-english") ? null : new Nabre();

const fixture = opt("--fixture");
const built = [];
const problems = [];

for (const date of dates) {
  let bytes, url;
  try {
    if (fixture) { bytes = new Uint8Array(readFileSync(fixture)); url = fixture; }
    else {
      const r = await fetchDlc(date);
      url = r.url;
      if (r.status === 404) { console.log(`${date}: not published yet (404)`); continue; }
      bytes = r.bytes;
    }
  } catch (e) {
    problems.push(`${date}: fetch failed: ${e.message}`);
    continue;
  }

  const page = parseDlcHtml(bytes);
  if ((has("--dump") && built.length === 0 && !problems.length) || !page.sections.length) {
    // Dump the first page's extracted text (and any page we failed to parse) for debugging.
    console.log(`\n===== ${date} ${url} [${page.charset}] =====`);
    for (const l of htmlToLines(decodeHtml(bytes).text).slice(0, 120)) console.log("  | " + l);
  }
  if (!page.sections.length) {
    problems.push(`${date}: no sections recognised (${page.lineCount} text lines, charset ${page.charset}). Re-run with --dump.`);
    continue;
  }

  const sections = [];
  for (const s of page.sections) {
    const lines = s.lines.map((l) => romanize(l));
    const out = { kind: s.kind, label: s.label, heading: s.heading, citation: s.citation?.text ?? null, lines };
    if (nabre && s.citation) {
      const { verses, missing } = await nabre.lookup(s.citation);
      if (verses.length) out.en = { source: "NABRE", book: s.citation.book, verses };
      if (missing.length) out.enMissing = missing;
    }
    sections.push(out);
  }

  const day = {
    date,
    source: fixture ? "fixture" : url,
    generated: new Date().toISOString(),
    title: page.title.map((t) => romanize(t)),
    sections,
  };
  writeFileSync(join(DATA, `${date}.json`), JSON.stringify(day));
  built.push(date);
  const kinds = sections.map((s) => s.kind + (s.en ? "+en" : "")).join(" ");
  console.log(`${date}: ${sections.length} sections [${kinds}] title="${page.title.join(" / ")}"`);
}

// Keep dates from a previous deployment that are still inside the window? No:
// Pages deployments replace the whole site, so the index is just what we built.
writeFileSync(join(DATA, "index.json"), JSON.stringify({ generated: new Date().toISOString(), dates: built.sort() }));
cpSync("site", OUT, { recursive: true });
writeFileSync(join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");

console.log(`\nBuilt ${built.length}/${dates.length} days into ${OUT}/`);
if (nabre) {
  console.log(`NABRE: ${nabre.fetched} chapter pages fetched this run, ${nabre.mem.size} chapters used`);
  for (const f of nabre.failed) console.warn("! NABRE " + f);
}
for (const p of problems) console.warn("! " + p);
if (!built.length && !fixture) {
  console.error("Nothing was built; failing so the previous deployment stays up.");
  process.exit(1);
}
