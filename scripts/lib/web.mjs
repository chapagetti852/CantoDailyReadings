// World English Bible (public domain) loader. Expects eBible.org "verse per
// line" text: one line per verse, "GEN 1:1<tab or space>In the beginning...".
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { expandVerses, toEnglish } from "./citation.mjs";

const LINE = /^([1-3A-Z][A-Z0-9]{2})\s+(\d+):(\d+)\s*[\t ]\s*(.*)$/;

export function parseVpl(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const body = m[4].replace(/¶/g, "").replace(/\s+/g, " ").trim();
    if (body) map.set(`${m[1]} ${m[2]}:${m[3]}`, body);
  }
  return map;
}

/** Load the largest *.txt under dir (the VPL zip extracts to one file). */
export function loadWeb(dir = "cache/web") {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"))
    .map((f) => join(dir, f)).sort((a, b) => statSync(b).size - statSync(a).size);
  if (!files.length) return null;
  const map = parseVpl(readFileSync(files[0], "utf8"));
  return map.size ? map : null;
}

/**
 * Resolve a parsed citation against the WEB map.
 * @returns {{verses: {ref:string, text:string}[], missing: string[]}}
 */
export function lookup(web, cit) {
  const verses = [];
  const missing = [];
  let openEndStopped = false;
  for (const { c, v, openEnd } of expandVerses(cit)) {
    if (openEnd && openEndStopped) continue;
    let hit = null;
    for (const cand of toEnglish(cit.book, c, v)) {
      const t = web.get(`${cand.book} ${cand.c}:${cand.v}`);
      if (t) { hit = { ref: `${cand.c}:${cand.v}`, text: t }; break; }
    }
    if (hit) verses.push(hit);
    else if (openEnd) openEndStopped = true; // ran past the end of the chapter
    else missing.push(`${c}:${v}`);
  }
  return { verses, missing };
}
