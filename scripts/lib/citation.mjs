import { bookFromText, CODE_TO_ABBR } from "./books.mjs";

/**
 * Parse a Studium Biblicum style citation into verse coordinates.
 *   "谷 6:14-29"            -> [{c:6, v:14}, ..., {c:6, v:29}]
 *   "詠 51:3-4, 12-13, 17"  -> ...
 *   "依 7:10-14; 8:10"      -> chapters separated by ;
 *   "出 19:16-20:21"        -> cross-chapter range
 * Half-verse letters (3a, 6b) are dropped. Returns null if nothing parses.
 */
export function parseCitation(text) {
  if (!text) return null;
  const book = bookFromText(text);
  if (!book) return null;
  const norm = text
    .replace(/[：]/g, ":").replace(/[，、]/g, ",").replace(/[；]/g, ";")
    .replace(/[–—－﹣]/g, "-").replace(/[（）()]/g, " ");
  const start = norm.search(/\d+\s*:\s*\d+/);
  if (start < 0) return null;
  // Take the reference part up to the first thing that is clearly not a reference.
  const refPart = norm.slice(start).replace(/[^\d:;,\-a-z\s].*$/i, "");
  const verses = [];
  for (const chunk of refPart.split(";")) {
    let chapter = null;
    for (let piece of chunk.split(",")) {
      piece = piece.replace(/\s+/g, "").replace(/[a-z]/g, "");
      if (!piece) continue;
      const cross = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(piece);
      if (cross) {
        const [, c1, v1, c2, v2] = cross.map(Number);
        verses.push({ c: c1, v: v1, to: { c: c2, v: v2 } });
        chapter = c2;
        continue;
      }
      let m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(piece);
      if (m) {
        chapter = Number(m[1]);
        pushRange(verses, chapter, Number(m[2]), m[3] ? Number(m[3]) : Number(m[2]));
        continue;
      }
      m = /^(\d+)(?:-(\d+))?$/.exec(piece);
      if (m && chapter != null) {
        pushRange(verses, chapter, Number(m[1]), m[2] ? Number(m[2]) : Number(m[1]));
      }
    }
  }
  const ref = refPart.replace(/\s+/g, "").replace(/,/g, ", ").replace(/;/g, "; ").trim();
  return verses.length ? { book, verses, raw: text.trim(), text: `${CODE_TO_ABBR[book]} ${ref}` } : null;
}

function pushRange(out, c, a, b) {
  if (b < a) b = a;
  if (b - a > 200) b = a + 200;
  for (let v = a; v <= b; v++) out.push({ c, v });
}

// ---------------------------------------------------------------------------
// Versification: 思高 follows the Hebrew/Vulgate chapter and verse layout in
// many places where English Bibles (and the WEB) differ. Each rule maps a
// 思高 range to the English coordinate of its first verse; the rest follow.
// Best-effort: unmapped verses are looked up at the same coordinates.
// ---------------------------------------------------------------------------
const R = (book, c, v1, v2, ec, ev) => ({ book, c, v1, v2, ec, ev });
const RULES = [
  R("GEN", 32, 1, 1, 31, 55), R("GEN", 32, 2, 33, 32, 1),
  R("EXO", 7, 26, 29, 8, 1), R("EXO", 8, 1, 28, 8, 5),
  R("EXO", 21, 37, 37, 22, 1), R("EXO", 22, 1, 30, 22, 2),
  R("LEV", 5, 20, 26, 6, 1), R("LEV", 6, 1, 23, 6, 8),
  R("NUM", 17, 1, 15, 16, 36), R("NUM", 17, 16, 28, 17, 1),
  R("NUM", 30, 1, 1, 29, 40), R("NUM", 30, 2, 17, 30, 1),
  R("DEU", 13, 1, 1, 12, 32), R("DEU", 13, 2, 19, 13, 1),
  R("DEU", 23, 1, 1, 22, 30), R("DEU", 23, 2, 26, 23, 1),
  R("DEU", 28, 69, 69, 29, 1), R("DEU", 29, 1, 28, 29, 2),
  R("1SA", 21, 1, 1, 20, 42), R("1SA", 21, 2, 16, 21, 1),
  R("1SA", 24, 1, 1, 23, 29), R("1SA", 24, 2, 23, 24, 1),
  R("2SA", 19, 1, 1, 18, 33), R("2SA", 19, 2, 44, 19, 1),
  R("1KI", 5, 1, 14, 4, 21), R("1KI", 5, 15, 32, 5, 1),
  R("2KI", 12, 1, 1, 11, 21), R("2KI", 12, 2, 22, 12, 1),
  R("1CH", 5, 27, 41, 6, 1), R("1CH", 6, 1, 66, 6, 16),
  R("2CH", 1, 18, 18, 2, 1), R("2CH", 2, 1, 17, 2, 2),
  R("2CH", 13, 23, 23, 14, 1), R("2CH", 14, 1, 14, 14, 2),
  R("NEH", 3, 33, 38, 4, 1), R("NEH", 4, 1, 17, 4, 7),
  R("NEH", 10, 1, 1, 9, 38), R("NEH", 10, 2, 40, 10, 1),
  R("JOB", 40, 25, 32, 41, 1), R("JOB", 41, 1, 26, 41, 9),
  R("ECC", 4, 17, 17, 5, 1), R("ECC", 5, 1, 19, 5, 2),
  R("SNG", 7, 1, 1, 6, 13), R("SNG", 7, 2, 14, 7, 1),
  R("ISA", 8, 23, 23, 9, 1), R("ISA", 9, 1, 20, 9, 2),
  R("ISA", 64, 1, 11, 64, 2),
  R("JER", 8, 23, 23, 9, 1), R("JER", 9, 1, 25, 9, 2),
  R("EZK", 21, 1, 5, 20, 45), R("EZK", 21, 6, 37, 21, 1),
  R("DAN", 3, 91, 97, 3, 24), R("DAN", 3, 98, 100, 4, 1), R("DAN", 4, 1, 34, 4, 4),
  R("DAN", 5, 31, 31, 6, 1), R("DAN", 6, 1, 28, 6, 2),
  R("HOS", 2, 1, 2, 1, 10), R("HOS", 2, 3, 25, 2, 1),
  R("HOS", 12, 1, 1, 11, 12), R("HOS", 12, 2, 15, 12, 1),
  R("HOS", 14, 1, 1, 13, 16), R("HOS", 14, 2, 10, 14, 1),
  R("JOL", 3, 1, 5, 2, 28), R("JOL", 4, 1, 21, 3, 1),
  R("JON", 2, 1, 1, 1, 17), R("JON", 2, 2, 11, 2, 1),
  R("MIC", 4, 14, 14, 5, 1), R("MIC", 5, 1, 14, 5, 2),
  R("NAM", 2, 1, 1, 1, 15), R("NAM", 2, 2, 14, 2, 1),
  R("ZEC", 2, 1, 4, 1, 18), R("ZEC", 2, 5, 17, 2, 1),
  R("MAL", 3, 19, 24, 4, 1),
];

// Psalms: 思高 numbers the Hebrew superscription as verse 1 (or 1-2).
const PSALM_OFFSET_1 = new Set([3, 4, 5, 6, 7, 8, 9, 12, 13, 18, 19, 20, 21, 22, 30, 31, 34, 36, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48, 49, 53, 55, 56, 57, 58, 59, 61, 62, 63, 64, 65, 67, 68, 69, 70, 75, 76, 77, 80, 81, 83, 84, 85, 88, 89, 92, 102, 108, 140, 142]);
const PSALM_OFFSET_2 = new Set([51, 52, 54, 60]);

/**
 * Map a 思高 verse coordinate to candidate WEB coordinates, most likely first.
 * @returns {{book:string, c:number, v:number}[]}
 */
export function toEnglish(book, c, v) {
  if (book === "PSA") {
    const off = PSALM_OFFSET_2.has(c) ? 2 : PSALM_OFFSET_1.has(c) ? 1 : 0;
    const ev = v - off;
    return ev >= 1 ? [{ book, c, v: ev }] : [{ book, c, v: 1 }];
  }
  if (book === "DAN") {
    if (c === 3 && v >= 24 && v <= 90) {
      // Greek additions: Prayer of Azariah and Song of the Three (S3Y 1-68)
      return [{ book: "DAG", c: 3, v }, { book: "S3Y", c: 1, v: v - 23 }];
    }
    if (c === 13) return [{ book: "SUS", c: 1, v }, { book: "DAG", c: 13, v }];
    if (c === 14) return [{ book: "BEL", c: 1, v }, { book: "DAG", c: 14, v }];
  }
  if (book === "BAR" && c === 6) return [{ book: "LJE", c: 1, v }, { book: "LJE", c: 6, v }, { book, c, v }];
  for (const r of RULES) {
    if (r.book === book && r.c === c && v >= r.v1 && v <= r.v2) {
      return [{ book, c: r.ec, v: r.ev + (v - r.v1) }];
    }
  }
  return [{ book, c, v }];
}

/** Expand a parsed citation into an ordered list of 思高 coordinates. */
export function expandVerses(cit, maxVerses = 400) {
  const out = [];
  for (const x of cit.verses) {
    if (x.to) {
      // Cross-chapter range: take the rest of the start chapter (up to 200)
      // and the beginning of the end chapter; the Bible loader trims to real verses.
      for (let v = x.v; v <= x.v + 200; v++) out.push({ c: x.c, v, openEnd: true });
      for (let v = 1; v <= x.to.v; v++) out.push({ c: x.to.c, v });
    } else out.push({ c: x.c, v: x.v });
    if (out.length > maxVerses) break;
  }
  return out;
}
