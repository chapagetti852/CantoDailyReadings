(() => {
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const SETTINGS_KEY = "cdr.settings";
  const HK_OFFSET = 8 * 3600e3;
  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

  let settings = { ruby: true, en: true, size: 18 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch {}
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };

  const hkToday = () => new Date(Date.now() + HK_OFFSET).toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 星期${WEEKDAY[d.getUTCDay()]}`; };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function applySettings() {
    document.body.classList.toggle("noruby", !settings.ruby);
    document.body.classList.toggle("noen", !settings.en);
    document.documentElement.style.setProperty("--base", settings.size + "px");
    $("tRuby").setAttribute("aria-pressed", String(settings.ruby));
    $("tEn").setAttribute("aria-pressed", String(settings.en));
  }

  function rubyHtml(line) {
    const chars = Array.from(line.zh);
    let out = "";
    chars.forEach((ch, i) => {
      const y = line.yale[i];
      out += y ? `<ruby>${esc(ch)}<rt>${esc(y)}</rt></ruby>` : esc(ch);
    });
    return out;
  }

  const RUBRIC = /^（[^）]*）$|^或$|^\(.*\)$/;

  function enHtml(s) {
    if (!s.en) return "";
    const src = s.en.source === "Lectionary"
      ? `Lectionary (USCCB)${s.en.citation ? " · " + esc(s.en.citation) : ""}`
      : "New American Bible, Revised Edition";
    let body;
    if (s.en.verses) {
      body = s.en.verses.map((v) => `<sup>${esc(v.ref.split(":")[1])}</sup>${esc(v.text)}`).join(" ");
    } else {
      const keepLines = s.kind === "psalm" || s.kind === "alleluia" || s.kind === "sequence";
      const ls = s.en.lines.map((l) => (/^R\.|^R:/.test(l) ? `<b>${esc(l)}</b>` : esc(l)));
      body = keepLines ? ls.join("<br>") : ls.join(" ");
    }
    return `<p class="en" lang="en" translate="yes">${body}<span class="src">${src}</span></p>`;
  }

  function render(day) {
    let html = "";
    const [first, ...rest] = day.title;
    if (first) html += `<h1>${rubyHtml(first)}</h1>`;
    for (const t of rest) html += `<p class="title-sub">${rubyHtml(t)}</p>`;
    for (const s of day.sections) {
      if (s.kind === "divider") {
        const [h, ...more] = s.lines;
        html += `<h1 class="divider">${h ? rubyHtml(h) : esc(s.label)}</h1>`;
        for (const line of more) html += `<p class="title-sub">${rubyHtml(line)}</p>`;
        continue;
      }
      html += `<h2>${esc(s.label)}${s.citation ? `<small>${esc(s.citation)}</small>` : ""}</h2>`;
      for (const line of s.lines) {
        const cls = RUBRIC.test(line.zh) ? "zh rubric" : /^【答】|^答[:：]/.test(line.zh) ? "zh resp" : "zh";
        html += `<p class="${cls}">${rubyHtml(line)}</p>`;
      }
      html += enHtml(s);
    }
    main.innerHTML = html;
    $("src").textContent = day.source && day.source.startsWith("http") ? `來源：${day.source} · 建於 ${day.generated.slice(0, 10)}` : "";
  }

  let current = null;
  async function show(date) {
    current = date;
    location.hash = date;
    $("dateText").textContent = fmtDate(date);
    main.innerHTML = `<p class="muted">載入中…</p>`;
    try {
      const res = await fetch(`data/${date}.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      const day = await res.json();
      if (current !== date) return;
      render(day);
      window.scrollTo(0, 0);
    } catch (e) {
      main.innerHTML = `<div class="err">${esc(fmtDate(date))} 的讀經尚未發佈或未能載入。<br>只保留最近數日至兩週後的內容。</div>`;
      $("src").textContent = "";
    }
  }

  const dateFromHash = () => (/^#(\d{4}-\d{2}-\d{2})$/.exec(location.hash) || [])[1];

  $("prev").onclick = () => show(addDays(current, -1));
  $("next").onclick = () => show(addDays(current, 1));
  $("today").onclick = () => show(hkToday());
  $("tRuby").onclick = () => { settings.ruby = !settings.ruby; saveSettings(); applySettings(); };
  $("tEn").onclick = () => { settings.en = !settings.en; saveSettings(); applySettings(); };
  $("sizeDown").onclick = () => { settings.size = Math.max(14, settings.size - 1); saveSettings(); applySettings(); };
  $("sizeUp").onclick = () => { settings.size = Math.min(28, settings.size + 1); saveSettings(); applySettings(); };
  window.addEventListener("hashchange", () => { const d = dateFromHash(); if (d && d !== current) show(d); });

  // Swipe left/right to change day
  let touchX = null;
  document.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 90) show(addDays(current, dx < 0 ? 1 : -1));
  }, { passive: true });

  applySettings();
  show(dateFromHash() || hkToday());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
