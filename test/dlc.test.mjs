import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDlcHtml, dlcUrl } from "../scripts/lib/dlc.mjs";

test("dlc url", () => {
  assert.equal(dlcUrl("2026-02-06"), "http://catholic-dlc.org.hk/mt260206.htm");
});

for (const f of ["mt-sample.htm", "mt-sample-big5.htm"]) {
  test(`parse fixture ${f}`, () => {
    const page = parseDlcHtml(new Uint8Array(readFileSync(`test/fixtures/${f}`)));
    assert.deepEqual(page.title, ["2026年2月6日（星期五）", "聖保祿三木及同伴（殉道）（紀念）"]);
    assert.deepEqual(page.sections.map((s) => s.kind),
      ["entrance", "collect", "reading1", "psalm", "alleluia", "gospel", "offertory", "communion", "postcommunion"]);
    const gospel = page.sections.find((s) => s.kind === "gospel");
    assert.equal(gospel.citation.text, "谷 6:14-29");
    assert.equal(gospel.lines[0], "恭讀聖馬爾谷福音 6:14-29");
    assert.match(gospel.lines[1], /^那時候/);
    assert.equal(page.sections.find((s) => s.kind === "psalm").citation.text, "詠 18:31, 47, 50, 51");
    assert.equal(page.sections.find((s) => s.kind === "alleluia").citation.text, "瑪 5:10");
    const last = page.sections.at(-1);
    assert.ok(!last.lines.some((l) => /上一天|返回/.test(l)), "nav stripped");
  });
}

