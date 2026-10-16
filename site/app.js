(() => {
  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const SETTINGS_KEY = "cdr.settings";
  const HK_OFFSET = 8 * 3600e3;
  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

  // Chinese is the base layer of each group; a translation can only show on top of it.
  let settings = { ruby: true, read: true, readEn: true, prop: false, propEn: true, propLa: false, rtSize: 11, zhSize: 20 };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if ("propers" in saved) { saved.prop = saved.propers; saved.propLa = !!saved.la; delete saved.propers; delete saved.la; delete saved.en; }
    for (const k of Object.keys(settings)) if (k in saved) settings[k] = saved[k];
  } catch {}
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };

  const hkToday = () => new Date(Date.now() + HK_OFFSET).toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 星期${WEEKDAY[d.getUTCDay()]}`; };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function applySettings() {
    const b = document.body.classList;
    b.toggle("noruby", !settings.ruby);
    b.toggle("noread", !settings.read);
    b.toggle("noread-en", !settings.readEn);
    b.toggle("noprop", !settings.prop);
    b.toggle("noprop-en", !settings.propEn);
    b.toggle("noprop-la", !settings.propLa);
    document.documentElement.style.setProperty("--rt-size", settings.rtSize + "px");
    document.documentElement.style.setProperty("--zh-size", settings.zhSize + "px");
    $("rtSize").value = settings.rtSize; $("zhSize").value = settings.zhSize;
    $("tRuby").setAttribute("aria-pressed", String(settings.ruby));
    $("tRead").setAttribute("aria-pressed", String(settings.read));
    $("tProp").setAttribute("aria-pressed", String(settings.prop));
    $("readZh").setAttribute("aria-pressed", String(settings.read));
    $("readEn").setAttribute("aria-pressed", String(settings.read && settings.readEn));
    $("propZh").setAttribute("aria-pressed", String(settings.prop));
    $("propEn").setAttribute("aria-pressed", String(settings.prop && settings.propEn));
    $("propLa").setAttribute("aria-pressed", String(settings.prop && settings.propLa));
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
    if (day.titleLa) html += `<p class="title-la" lang="la" translate="yes">${esc(day.titleLa)}</p>`;
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
  // The 讀 / 禱 / Aa coins open their option rows; only one row is open at a time.
  const PANELS = { tRead: "readOpts", tProp: "propOpts", tSize: "sizes" };
  function openPanel(btnId) {
    for (const [b, panel] of Object.entries(PANELS)) {
      const open = b === btnId && $(panel).hidden;
      $(panel).hidden = !open;
      $(b).setAttribute("aria-expanded", String(open));
    }
  }
  for (const b of Object.keys(PANELS)) $(b).onclick = () => openPanel(b);
  // Group chips: Chinese is the group itself; a translation switches the group on with it.
  $("readZh").onclick = () => { settings.read = !settings.read; saveSettings(); applySettings(); };
  $("readEn").onclick = () => { if (!settings.read) { settings.read = true; settings.readEn = true; } else settings.readEn = !settings.readEn; saveSettings(); applySettings(); };
  $("propZh").onclick = () => { settings.prop = !settings.prop; saveSettings(); applySettings(); };
  $("propEn").onclick = () => { if (!settings.prop) { settings.prop = true; settings.propEn = true; } else settings.propEn = !settings.propEn; saveSettings(); applySettings(); };
  $("propLa").onclick = () => { if (!settings.prop) { settings.prop = true; settings.propLa = true; } else settings.propLa = !settings.propLa; saveSettings(); applySettings(); };
  $("rtSize").oninput = (e) => { settings.rtSize = Number(e.target.value); saveSettings(); applySettings(); };
  $("zhSize").oninput = (e) => { settings.zhSize = Number(e.target.value); saveSettings(); applySettings(); };
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
