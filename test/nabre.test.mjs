import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { parseChapterHtml, chapterUrls, Nabre } from "../scripts/lib/nabre.mjs";
import { parseCitation } from "../scripts/lib/citation.mjs";

test("chapter urls", () => {
  assert.equal(chapterUrls("MRK", 6)[0], "https://bible.usccb.org/bible/mark/6");
  assert.equal(chapterUrls("1CO", 13)[0], "https://bible.usccb.org/bible/1corinthians/13");
  assert.ok(chapterUrls("PHM", 1).includes("https://bible.usccb.org/bible/philemon"));
  assert.ok(chapterUrls("SNG", 2).includes("https://bible.usccb.org/bible/songofsolomon/2"));
});

test("parse a NABRE chapter page", () => {
  const { verses } = parseChapterHtml(readFileSync("test/fixtures/nabre-mark-6.html", "utf8"));
  assert.deepEqual([...verses.keys()], [14, 15, 16, 17]);
  assert.match(verses.get(14), /^King Herod heard about it/);
  assert.ok(!verses.get(14).includes("a King"), "footnote letter stripped");
  assert.match(verses.get(16), /^But when Herod learned of it/);
  assert.ok(!verses.get(17).includes("This is the only mention"), "footnotes block stripped");
  assert.ok(!verses.get(17).includes("Copyright"), "footer stripped");
});

test("parser falls back to plain <sup> verse numbers", () => {
  const html = `<body><div><p><sup>1</sup>In the beginning<sup>a</sup> God created.</p><p><sup>2</sup>The earth was waste.</p></div></body>`;
  const { verses } = parseChapterHtml(html);
  assert.deepEqual([...verses.entries()], [[1, "In the beginning God created."], [2, "The earth was waste."]]);
});

test("lookup fetches once per chapter and caches to disk", async () => {
  const dir = "cache/nabre-test";
  rmSync(dir, { recursive: true, force: true });
  const html = readFileSync("test/fixtures/nabre-mark-6.html", "utf8");
  let calls = 0;
  const fetchImpl = async (url) => { calls++; return { ok: url.endsWith("/mark/6"), status: url.endsWith("/mark/6") ? 200 : 404, text: async () => html }; };
  const n = new Nabre({ cacheDir: dir, fetchImpl, delayMs: 0, log: { warn() {} } });
  const r = await n.lookup(parseCitation("谷 6:14-29"));
  assert.deepEqual(r.verses.map((v) => v.ref), ["6:14", "6:15", "6:16", "6:17"]);
  assert.equal(r.missing.length, 12);
  assert.equal(calls, 1);
  assert.ok(existsSync(`${dir}/MRK/6.json`));
  const n2 = new Nabre({ cacheDir: dir, fetchImpl, delayMs: 0 });
  await n2.lookup(parseCitation("谷 6:16"));
  assert.equal(calls, 1, "second instance served from disk cache");
  rmSync(dir, { recursive: true, force: true });
});
