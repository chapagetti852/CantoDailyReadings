# Canto Daily Readings · 每日讀經

Personal, mobile-first web page showing the Hong Kong Diocese daily Mass readings
and propers in Chinese, with **Yale Cantonese romanization as ruby text** over every
character and the **New American Bible, Revised Edition (NABRE)** text of the same
scripture passages underneath.

Everything is static and hosted on GitHub Pages. A scheduled GitHub Action rebuilds the
site every night, so no server and no API keys are involved.

## How it works

```
catholic-dlc.org.hk/mtYYMMDD.htm ──► scripts/lib/dlc.mjs   (fetch + parse sections)
                                          │
overrides.json ──► to-jyutping ──► scripts/lib/yale.mjs   (Jyutping → Yale per character)
                                          │
bible.usccb.org/bible/<book>/<ch> ──► scripts/lib/nabre.mjs (NABRE verses by 思高 citation, cached)
                                          │
                                   dist/data/YYYY-MM-DD.json  +  site/  ──► GitHub Pages
```

- **Rolling window.** Each build fetches 3 days back and 14 days ahead (Hong Kong time)
  and deploys them as a Pages artifact. The texts are never committed to git; they live
  only in the current deployment. The page carries `noindex` and a `robots.txt`.
- **Chinese source.** The Diocesan Liturgy Commission's daily page, one per date.
  Sections recognised: 進堂詠, 集禱經, 讀經一, 答唱詠, 讀經二, 繼抒詠, 福音前歡呼, 福音,
  獻禮經, 頌謝詞, 領主詠, 領聖體後經.
- **Romanization.** `to-jyutping` (BSD-2, built on the CC-BY rime-cantonese lexicon) gives
  word-aware Jyutping; a small converter turns it into Yale with diacritics (tone 1 = macron).
  Fix a mispronunciation by adding the word to `overrides.json`.
- **English.** Only for the readings, psalm and Gospel, and only official text. Driven by
  the citation on the Chinese page, so it always matches the Hong Kong day:
  1. If the USCCB daily readings page for the same date reads the same passage (verse
     overlap of 80% or more), its Lectionary wording is used; the Gospel acclamation comes
     along when the Gospel matches.
  2. Otherwise the cited verses are taken from the NABRE chapter pages on the USCCB site.
  Pages are fetched politely (one every few seconds, retry with backoff, a per-run cap, and
  a stop on persistent 403) and kept in the Actions cache, so each page is fetched once.
  NABRE and 思高 share the Hebrew chapter/verse numbering, so no re-versification is needed.
  Antiphons, collects and other prayers are Chinese only.
- **App.** `site/` is plain HTML/CSS/JS: date arrows and swipe, Yale and EN toggles, text
  size, dark mode, offline cache of visited days via a service worker, installable to the
  home screen. The page is marked `translate="no"` so browsers do not offer to translate
  the Chinese; the English blocks are marked `lang="en"`.

## Setup (once)

1. Push this repository to GitHub and make `main` the default branch.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions → Build and deploy → Run workflow.** The log prints the first fetched page's
   extracted text (`--dump`) and one line per day with the sections it found.
4. Open the Pages URL on your phone and add it to the home screen.

The workflow also runs nightly at 01:40 HKT and on every push to `main`.

## First-run checklist

The DLC page parser was written without access to the live site, against the expected
layout (see `test/fixtures/mt-sample.htm`). If the first Action run reports
`no sections recognised`, read the dumped text lines in the log and adjust `HEADERS` and
`NOISE` in `scripts/lib/dlc.mjs`; the fixtures and tests show the intended output.

If English is missing, look for `! NABRE` lines at the end of the build log. A chapter page
that was fetched but not understood is dumped there; adjust `MARKER_PATTERNS`,
`contentRegion` or `stripNotes` in `scripts/lib/nabre.mjs` and add the page to
`test/fixtures/` as a test. HTTP 403 would mean the site is blocking the runner.

## Local development

```sh
npm install
npm test                 # unit tests (DLC parser, citations, NABRE parser, Yale)
npm run build:fixture    # build dist/ from the sample page, no network, no English
npx http-server dist     # or: python3 -m http.server --directory dist
```

To build real dates locally: `node scripts/build.mjs --dates 2026-10-16,2026-10-17 --dump`.
Fetched NABRE chapters accumulate in `cache/nabre/` (git-ignored).

## Licences and sources

- Readings and prayers © Hong Kong Diocesan Liturgy Commission / Studium Biblicum O.F.M.
  Fetched for personal use only; nothing is redistributed beyond the rolling window.
- NABRE © Confraternity of Christian Doctrine; fetched from bible.usccb.org for personal use only.
- to-jyutping: BSD-2-Clause; rime-cantonese lexicon: CC BY 4.0.
