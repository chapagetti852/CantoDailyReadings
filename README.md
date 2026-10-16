# Canto Daily Readings · 每日讀經

Personal, mobile-first web page showing the Hong Kong Diocese daily Mass readings
and propers in Chinese, with **Yale Cantonese romanization as ruby text** over every
character and the **World English Bible** text of the same scripture passages underneath.

Everything is static and hosted on GitHub Pages. A scheduled GitHub Action rebuilds the
site every night, so no server and no API keys are involved.

## How it works

```
catholic-dlc.org.hk/mtYYMMDD.htm ──► scripts/lib/dlc.mjs   (fetch + parse sections)
                                          │
overrides.json ──► to-jyutping ──► scripts/lib/yale.mjs   (Jyutping → Yale per character)
                                          │
ebible.org WEB (public domain) ──► scripts/lib/web.mjs    (verses by 思高 citation, re-versified)
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
- **English.** Guaranteed to match the Hong Kong day because it is driven by the citation on
  the Chinese page, not by a foreign calendar. 思高 chapter/verse numbering is mapped to
  English numbering (psalm superscriptions, Malachi 3:19 = 4:1, Joel 3 = 2:28, and so on) in
  `scripts/lib/citation.mjs`. Prayers and antiphons without a citation are Chinese only.
- **App.** `site/` is plain HTML/CSS/JS: date arrows and swipe, Yale and EN toggles, text
  size, dark mode, offline cache of visited days via a service worker, installable to the
  home screen.

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

If English is missing, check the "Fetch World English Bible" step: it tries
`engwebc_vpl.zip`, then `engweb_vpl.zip`, from eBible.org.

## Local development

```sh
npm install
npm test                 # unit tests (parser, citations, versification, Yale)
npm run build:fixture    # build dist/ from the sample page, no network needed
npx http-server dist     # or: python3 -m http.server --directory dist
```

To build real dates locally: `node scripts/build.mjs --dates 2026-10-16,2026-10-17 --dump`.
Run `scripts/fetch-web.sh` first if you want English text.

## Licences and sources

- Readings and prayers © Hong Kong Diocesan Liturgy Commission / Studium Biblicum O.F.M.
  Fetched for personal use only; nothing is redistributed beyond the rolling window.
- World English Bible: public domain (eBible.org).
- to-jyutping: BSD-2-Clause; rime-cantonese lexicon: CC BY 4.0.
