(() => {
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const SETTINGS_KEY = "cdr.settings";
  const HK_OFFSET = 8 * 3600e3;
  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

  let settings = { ruby: true, en: true, la: false, propers: false, size: 19 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch {}
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };

  const hkToday = () => new Date(Date.now() + HK_OFFSET).toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 星期${WEEKDAY[d.getUTCDay()]}`; };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function applySettings() {
    document.body.classList.toggle("noruby", !settings.ruby);
    document.body.classList.toggle("noen", !settings.en);
    document.body.classList.toggle("nola", !settings.la);
    document.body.classList.toggle("noprop", !settings.propers);
    document.documentElement.style.setProperty("--base", settings.size + "px");
    $("tRuby").setAttribute("aria-pressed", String(settings.ruby));
    $("tEn").setAttribute("aria-pressed", String(settings.en));
    $("tLa").setAttribute("aria-pressed", String(settings.la));
    $("tProp").setAttribute("aria-pressed", String(settings.propers));
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

  // "領：" / "眾：" / "【答】" are rubrical labels, not text to be read with romanization.
  const SPEAKER = /^(領|眾|答|主祭|司鐸|讀經員|全體|信友|執事)[：:]\s*/;
  function lineHtml(line) {
    let zh = line.zh, yale = line.yale, label = "";
    const m = SPEAKER.exec(zh);
    if (m) { label = `<span class="who">${esc(m[1])}</span>`; zh = zh.slice(m[0].length); yale = yale.slice(Array.from(m[0]).length); }
    let body = rubyHtml({ zh, yale });
    body = body.replace(/(?:<ruby>【<rt>[^<]*<\/rt><\/ruby>|【)(?:<ruby>答<rt>[^<]*<\/rt><\/ruby>|答)(?:<ruby>】<rt>[^<]*<\/rt><\/ruby>|】)(?:[：:])?/g, '<span class="who resp-mark">答</span>');
    return label + body;
  }

  const RUBRIC = /^（[^）]*）$|^或$|^\(.*\)$/;

  function enHtml(s) {
    if (!s.en) return "";
    let body;
    if (s.en.verses) {
      body = s.en.verses.map((v) => `<sup>${esc(v.ref.split(":")[1])}</sup>${esc(v.text)}`).join(" ");
    } else {
      const keepLines = s.kind === "psalm" || s.kind === "alleluia" || s.kind === "sequence";
      const ls = s.en.lines.map((l) => (/^R\.|^R:/.test(l) ? `<b><span class="r">R.</span> ${esc(l.replace(/^R\.?\s*(\([^)]*\))?\s*/, ""))}</b>` : /^(Or|Vel)\b/.test(l) ? `<i class="alt">${esc(l)}</i>` : esc(l)));
      body = keepLines ? ls.join("<br>") : ls.join(" ");
    }
    return `<p class="en" lang="en" translate="yes">${body}</p>`;
  }

  function laHtml(s) {
    if (!s.la) return "";
    const ls = s.la.lines.map((l) => (/^(Vel|Or)\b/.test(l) ? `<i class="alt">${esc(l)}</i>` : esc(l)));
    const keep = s.kind === "entrance" || s.kind === "communion";
    return `<p class="la" lang="la" translate="yes">${keep ? ls.join("<br>") : ls.join(" ")}</p>`;
  }

  function render(day) {
    let html = "";
    const [first, ...rest] = day.title;
    if (first) html += `<h1>${esc(first.zh)}</h1>`;
    for (const t of rest) html += `<p class="title-sub">${esc(t.zh)}</p>`;
    if (day.titleEn) html += `<p class="title-en en" lang="en" translate="yes">${esc(day.titleEn)}</p>`;
    for (const s of day.sections) {
      if (s.kind === "divider") {
        const [h, ...more] = s.lines;
        html += `<h1 class="divider">${h ? esc(h.zh) : esc(s.label)}</h1>`;
        for (const line of more) html += `<p class="title-sub">${esc(line.zh)}</p>`;
        continue;
      }
      if (s.kind === "note") {
        html += `<details class="note"><summary>${esc(s.label)}</summary>${s.lines.map((l) => `<p class="zh">${lineHtml(l)}</p>`).join("")}</details>`;
        continue;
      }
      html += `<section class="${s.proper ? "proper" : "reading"}"><h2><span>${esc(s.label)}</span>${s.citation ? `<small>${esc(s.citation)}</small>` : ""}</h2>`;
      for (const line of s.lines) {
        const cls = RUBRIC.test(line.zh) ? "zh rubric" : /^【答】|^答[:：]/.test(line.zh) ? "zh resp" : /^——/.test(line.zh) ? "zh accl" : /^恭讀/.test(line.zh) ? "zh intro" : "zh";
        html += `<p class="${cls}">${RUBRIC.test(line.zh) ? esc(line.zh) : lineHtml(line)}</p>`;
      }
      html += enHtml(s) + laHtml(s) + "</section>";
    }
    main.innerHTML = html;
    $("src").textContent = day.source && day.source.startsWith("http") ? `來源：${day.source.replace(/^https?:\/\//, "")} · ${day.generated.slice(0, 10)}` : "";
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
  $("tLa").onclick = () => { settings.la = !settings.la; saveSettings(); applySettings(); };
  $("tProp").onclick = () => { settings.propers = !settings.propers; saveSettings(); applySettings(); };
  $("sizeDown").onclick = () => { settings.size = Math.max(14, settings.size - 1); saveSettings(); applySettings(); };
  $("sizeUp").onclick = () => { settings.size = Math.min(34, settings.size + 1); saveSettings(); applySettings(); };
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
