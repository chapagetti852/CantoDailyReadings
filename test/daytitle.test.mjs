import test from "node:test";
import assert from "node:assert/strict";
import { englishDayTitle, zhNumber } from "../scripts/lib/daytitle.mjs";
import { parseDayTitle } from "../scripts/lib/lectionary.mjs";
import { readFileSync } from "node:fs";

test("chinese numerals", () => {
  assert.equal(zhNumber("二十八"), 28); assert.equal(zhNumber("十"), 10); assert.equal(zhNumber("三十"), 30); assert.equal(zhNumber("十一"), 11); assert.equal(zhNumber("五"), 5);
});
test("ferial and sunday titles", () => {
  assert.equal(englishDayTitle("常年期第二十八周星期五"), "Friday of the Twenty-eighth Week in Ordinary Time");
  assert.equal(englishDayTitle("常年期第三十主日"), "Thirtieth Sunday in Ordinary Time");
  assert.equal(englishDayTitle("將臨期第一周星期三"), "Wednesday of the First Week of Advent");
  assert.equal(englishDayTitle("復活期第二主日"), "Second Sunday of Easter");
  assert.equal(englishDayTitle("聖依納爵主教．安提約基亞（殉道）（紀念）"), null);
  assert.equal(englishDayTitle("十月十六日"), null);
});
test("USCCB day title", () => {
  assert.equal(parseDayTitle(readFileSync("test/fixtures/usccb-readings.html", "utf8")), "Friday of the Twenty-eighth Week in Ordinary Time");
  assert.equal(parseDayTitle("<html><head><title>Daily Readings | USCCB</title></head><body><h2>Memorial of Saint Luke</h2></body></html>"), "Memorial of Saint Luke");
});
