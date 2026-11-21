// Jyson Live Preview: a simulated desktop with Mochi, the bar, Start and quick settings.
(() => {
  const $ = (id) => document.getElementById(id);
  const SONGS = [
    { t: "Glow", a: "Nova Lane", d: 168, c: ["#ff8a5c", "#d9466f"] },
    { t: "Midnight in Kaunas", a: "The Quiet Hours", d: 216, c: ["#5a8cff", "#2b3f8f"] },
    { t: "Everything We Said Before the Lights Came Back On (Extended Mix)", a: "Aurora Fields feat. Mika Rowe", d: 372, c: ["#70d99f", "#1f6f63"] },
    { t: "Run", a: "Kiro", d: 125, c: ["#e7bd6a", "#9b5b1d"] },
  ];
  const grad = (c) => `linear-gradient(135deg, ${c[0]}, ${c[1]})`;
  const S = { song: 1, pos: 61, playing: true, liked: false, shuffle: false, vol: 62, bright: 100, night: false, mic: true,
              autohide: false, voice: true, focus: false, bar: true, layer: null, hover: false, peek: false, timer: null,
              listening: false, cpu: 12, ram: 41, volOpen: false, busy: false, edge: false,
              answer: { q: "Remind me in 20 minutes to take a break", t: "Done. A 20-minute timer is on Mochi.", m: "Groq · 0.4 s" } };
  let touched = false;                         // the opening demo stops the moment someone starts trying things
  let lastPointer = "mouse";                   // Safari's click carries no pointerType
  addEventListener("pointerdown", (e) => { lastPointer = e.pointerType || "mouse"; }, true);
  const CI = {                                  // card icons
    mic: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4"/></svg>',
    clip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>',
    shot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></svg>',
    timer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7fa8ff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
  };
  // the real Jyson mark (assets/brand/jyson_icon.svg)
  const LOGO = '<rect x="8.64" y="8.64" width="238.72" height="238.72" rx="55.2" fill="#17191c" stroke="#3a3f46" stroke-width="5"/><g transform="translate(21.354 14.361) scale(3.4966)"><polygon points="18,12 48,12 43,21 13,21" fill="#7f95ad"/><path d="M37 21 V39 A10 10 0 0 1 17 39" fill="none" stroke="#f1f3f5" stroke-width="8" stroke-linecap="round"/></g>';
  CI.j = `<svg viewBox="0 0 256 256" width="22" height="22">${LOGO}</svg>`;
  document.documentElement.classList.add("js");
  const io = new IntersectionObserver((list) => {
    for (const en of list) if (en.isIntersecting) {
      const el = en.target, i = [...el.parentNode.children].indexOf(el);
      el.style.transitionDelay = (i % 2) * .1 + "s"; el.classList.add("seen"); io.unobserve(el);
      setTimeout(() => (el.style.transitionDelay = ""), 1200);
    }
  }, { threshold: .18 });
  document.querySelectorAll(".feat").forEach((f) => io.observe(f));

  // ---------------------------------------------------------------- the virtual screen
  const screen = $("screen"), viewport = $("viewport");
  let narrow = false, W = 1120, H = 680;
  function fit() {
    narrow = viewport.clientWidth < 700;
    W = narrow ? 520 : 1120; H = narrow ? 760 : 680;
    const scale = viewport.clientWidth / W;
    screen.style.width = W + "px"; screen.style.height = H + "px"; screen.style.transform = `scale(${scale})`;
    viewport.style.height = H * scale + "px";
    Object.assign($("win").style, narrow ? { left: "104px", top: "150px", width: "396px", height: "330px" }
                                         : { left: "110px", top: "92px", width: "500px", height: "330px" });
    $("start").style.width = narrow ? "360px" : "420px"; $("start").style.marginLeft = narrow ? "-180px" : "-210px";
    drawWall(); renderBar();
  }

  // a Windows 11 style bloom: petals of blue light folded around a point low in the middle (drawn, not a picture)
  function drawWall() {
    const cv = $("wall"), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H * (narrow ? .78 : .64), R = Math.min(W * .62, H * .9) * (narrow ? .78 : .62);
    const bg = g.createRadialGradient(cx, cy - R * .25, 0, cx, cy, Math.max(W, H) * .8);
    bg.addColorStop(0, "#1c5ad0"); bg.addColorStop(.45, "#0d3c9c"); bg.addColorStop(1, "#061a4a");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(cx, cy - R * .35, 0, cx, cy - R * .35, R * 1.2);
    glow.addColorStop(0, "rgba(120,190,255,.35)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // folded petals opening from one point, outer ones first so the middle one sits on top
    const petals = [[-1.32, .62, .9], [1.32, .62, .9], [-.92, .82, .8], [.92, .82, .8], [-.48, .95, .7], [.48, .95, .7], [0, 1.02, .6]];
    for (const [ang, size, dark] of petals) {
      const L = R * size, w = L * .36, side = Math.sign(ang) || 1;
      g.save(); g.translate(cx, cy + R * .18); g.rotate(ang * .78);
      g.shadowColor = "rgba(0,12,50,.55)"; g.shadowBlur = 40; g.shadowOffsetY = 10;
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(-w * (side > 0 ? .55 : 1.1), -L * .3, -w * .9, -L * .82, 0, -L);   // one edge fuller than the other: a fold
      g.bezierCurveTo(w * .9, -L * .82, w * (side > 0 ? 1.1 : .55), -L * .3, 0, 0);
      const pg = g.createLinearGradient(0, 0, 0, -L);
      pg.addColorStop(0, `rgba(8,34,120,${dark})`); pg.addColorStop(.5, "rgba(30,104,236,.92)"); pg.addColorStop(1, "rgba(150,214,255,.96)");
      g.fillStyle = pg; g.fill();
      g.shadowColor = "transparent";
      const sh = g.createLinearGradient(-w, 0, w, 0);                 // light on one side, shade on the other
      sh.addColorStop(0, side > 0 ? "rgba(0,10,60,.35)" : "rgba(210,240,255,.28)"); sh.addColorStop(.5, "rgba(0,0,0,0)");
      sh.addColorStop(1, side > 0 ? "rgba(210,240,255,.28)" : "rgba(0,10,60,.35)");
      g.fillStyle = sh; g.fill();
      g.strokeStyle = "rgba(190,230,255,.35)"; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
  }

  const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const plainTitle = (t) => t.replace(/\s*[\(\[].*$/, "");
  const short = (t, n = 22) => { const p = plainTitle(t); return p.length > n ? p.slice(0, n - 1) + "…" : p; };

  // ---------------------------------------------------------------- Mochi's strip (the middle stays put)
  const gl = $("gl"), gm = $("gm"), gr = $("gr"), mochi = $("mochi");
  function sync(group, items) {
    const live = [...group.children].filter((c) => !c._leaving);
    const have = new Map(live.map((c) => [c.dataset.s, c]));
    const keep = new Set(items.map((i) => i.k));
    for (const [k, c] of have) if (!keep.has(k)) {           // goes out the way it came, then leaves
      c._leaving = true; c.classList.remove("in"); group.appendChild(c); setTimeout(() => c.remove(), 320);
    }
    const firstLeaving = () => [...group.children].find((c) => c._leaving) || null;
    items.forEach((it, idx) => {
      let c = have.get(it.k);
      if (!c) {
        c = document.createElement("span"); c.dataset.s = it.k; c.className = "it " + (it.cls || "");
        requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add("in")));
      }
      if (c._h !== it.html) { c.innerHTML = it.html; c._h = it.html; }
      const now = [...group.children].filter((x) => !x._leaving);
      if (now[idx] !== c) group.insertBefore(c, now[idx] || firstLeaving());
    });
  }
  // the width a side needs for what stays in it (measured from the items, so the width can glide instead of jumping)
  const natural = (g) => { const k = [...g.children].filter((c) => !c._leaving); return k.reduce((s, c) => s + c.offsetWidth, 0) + Math.max(0, k.length - 1) * 12; };
  function renderStrip() {
    const song = SONGS[S.song];
    let left = [], right = [], mid = clock();
    if (S.listening) mid = '<span class="dot"></span>&nbsp;Listening...';
    else if (S.playing) {                       // the middle stays put; pointing at it only adds the sides
      left = [{ k: "cover" + S.song, html: `<span class="cover" style="background:${grad(song.c)}"></span>` }];
      mid = short(song.t);
      right = [{ k: "bars", html: '<span class="bars"><i></i><i></i><i></i><i></i></span>' }];
    }
    if (S.timer && !S.listening) {
      const left_s = Math.max(0, (S.timer.end - Date.now()) / 1000), share = left_s / S.timer.total;
      const r = 6, C = 2 * Math.PI * r;
      left.unshift({ k: "ring", html: `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${r}" fill="none" stroke="#2c3036" stroke-width="2"/><circle cx="8" cy="8" r="${r}" fill="none" stroke="#7fa8ff" stroke-width="2" stroke-dasharray="${(C * share).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 8 8)" stroke-linecap="round"/></svg>` });
      right.unshift({ k: "left", html: mmss(Math.ceil(left_s)), cls: "acc" });
    }
    if ((S.hover || S.peek) && !S.listening) { left.push({ k: "ram", html: `RAM ${S.ram}%` }); right.push({ k: "cpu", html: `CPU ${S.cpu}%` }); }
    if (gm._h !== mid) { gm.innerHTML = mid; gm._h = mid; }
    sync(gl, left); sync(gr, right);
    mochi.classList.toggle("playing", S.playing);
    const side = Math.max(natural(gl), natural(gr));
    gl.style.width = gr.style.width = side + "px";
    if (!S.layer) mochi.style.width = (gm.scrollWidth + 2 * side + 28) + "px";
  }

  // ---------------------------------------------------------------- layers, in the app's order
  // the music player while a song is there, then the last answer, then the Command Center; one wheel step each
  const HEIGHT = { media: 132, answer: 0, menu: 0 };
  function layers() { return ["media", S.answer ? "answer" : null, "menu"].filter(Boolean); }
  function setLayer(layer) {
    S.layer = layer; S.volOpen = false;
    mochi.classList.toggle("open", !!layer);
    for (const [id, name] of [["pMedia", "media"], ["pAnswer", "answer"], ["pMenu", "menu"]]) $(id).classList.toggle("show", layer === name);
    if (layer) {
      if (layer === "media") renderPlayer();
      if (layer === "answer") renderAnswer();
      if (layer === "menu") renderMenu();
      const panel = $({ media: "pMedia", answer: "pAnswer", menu: "pMenu" }[layer]);
      const h = layer === "media" ? 132 : panel.scrollHeight;
      mochi.style.width = "340px"; mochi.style.height = h + "px"; mochi.style.borderRadius = "0 0 20px 20px";
      hideTip();
    } else { mochi.style.height = "30px"; mochi.style.borderRadius = ""; renderStrip(); }
    autohide();
  }
  function step(dir) {
    const list = layers();
    const i = S.layer ? list.indexOf(S.layer) + dir : (dir > 0 ? 0 : -1);
    setLayer(i < 0 ? null : list[Math.min(i, list.length - 1)]);
  }
  let wheelAt = 0, wheelAcc = 0, leaveTimer = 0;
  function onWheel(e) {
    e.preventDefault(); touched = true;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < 60) return;                  // a touchpad sends many small steps: add them up
    const dir = Math.sign(wheelAcc), notch = Math.abs(e.deltaY) >= 50; wheelAcc = 0;
    if (Date.now() - wheelAt < (notch ? 45 : 240)) return; // one layer per wheel notch (45 ms, as in the app)
    wheelAt = Date.now(); step(dir);
  }
  mochi.addEventListener("wheel", onWheel, { passive: false });
  $("card").addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  mochi.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { clearTimeout(leaveTimer); S.hover = true; touched = true; renderStrip(); autohide(); } });
  mochi.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    S.hover = false; renderStrip();
    leaveTimer = setTimeout(() => { if (S.layer) setLayer(null); autohide(); }, 600);
  });
  let swipeY = null, swiped = 0;
  $("strip").addEventListener("click", () => {
    touched = true;
    if (Date.now() - swiped < 400) return;
    if (lastPointer === "mouse") { step(1); return; }
    if (!S.peek) { S.peek = true; renderStrip(); } else { S.peek = false; setLayer("media"); }
  });
  // on a phone: pull Mochi down for the next layer, push it up to go back
  mochi.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") swipeY = e.clientY; });
  mochi.addEventListener("pointerup", (e) => {
    if (swipeY === null) return;
    const dy = e.clientY - swipeY; swipeY = null;
    if (Math.abs(dy) > 24) { swiped = Date.now(); touched = true; S.peek = false; step(dy > 0 ? 1 : -1); }
  });
  // a tap or click anywhere else - on the screen or the page around it - puts Mochi away (for a mouse, leaving does it)
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".mochi, .card, #tUp, #tDown, #tPeek")) return;
    if (S.layer || S.peek) { S.peek = false; setLayer(null); }
    if (!e.target.closest(".qs, #qsBtn")) $("qs").classList.remove("show");
    if (!e.target.closest(".start, #startBtn")) $("start").classList.remove("show");
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && (S.layer || S.peek)) { S.peek = false; setLayer(null); } });

  // ---------------------------------------------------------------- the player
  const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5l13 7.5-13 7.5z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>';
  let phase = 0;
  function drawWave() {
    const cv = $("pWave");
    const w = cv.clientWidth || 160, h = cv.clientHeight || 14, dpr = 2;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const song = SONGS[S.song], share = Math.max(0, Math.min(1, S.pos / song.d)), end = Math.max(3, w * share), y = h / 2;
    g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(end, y); g.lineTo(w - 1.5, y); g.stroke();
    g.strokeStyle = "rgba(230,233,237,.92)"; g.lineWidth = 2.4; g.beginPath();
    if (S.playing && end > 12) {                           // the played part as a gentle wave while it plays
      for (let x = 1.5; x <= end; x += 1.5) { const yy = y + 2.2 * Math.sin((x - 1.5) / 3.2 - phase); x === 1.5 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
    } else { g.moveTo(1.5, y); g.lineTo(end, y); }
    g.stroke();
  }
  function placeButtons() {
    // centred on the panel (170 of 340); the volume slider sliding in pushes them left
    const w = $("pCtl").clientWidth || 306, centre = 156 - (S.volOpen ? 46 : 0);
    const pos = { pShuffle: centre - 84, pPrev: centre - 42, pPlay: centre, pNext: centre + 42 };
    for (const [id, x] of Object.entries(pos)) $(id).style.left = x + "px";
    $("pVolBtn").style.left = (w - 4) + "px";
    $("pVol").classList.toggle("open", S.volOpen);
    $("pVolI").style.width = S.vol + "%"; $("pVolB").style.left = S.vol + "%";
  }
  function renderPlayer() {
    const song = SONGS[S.song];
    $("pArt").style.background = grad(song.c); $("pArtist").textContent = song.a;
    const title = $("pTitle");
    if (title._song !== S.song) {                 // only on a new song, so the slide isn't restarted every second
      title._song = S.song; title.classList.remove("marq"); title.innerHTML = "<span></span>"; title.firstChild.textContent = song.t;
      const over = title.firstChild.scrollWidth - title.clientWidth;
      if (over > 4) { title.style.setProperty("--shift", -(over + 16) + "px"); title.style.setProperty("--dur", (3 + over / 30).toFixed(1) + "s"); title.classList.add("marq"); }
    }
    $("pNow").textContent = mmss(S.pos); $("pLeft").textContent = "-" + mmss(Math.max(0, song.d - S.pos));
    $("pPlay").innerHTML = S.playing ? PAUSE : PLAY;
    $("pLike").classList.toggle("on", S.liked); $("pLike").querySelector("path").setAttribute("fill", S.liked ? "currentColor" : "none");
    $("pShuffle").classList.toggle("on", S.shuffle);
    placeButtons(); drawWave();
  }
  function setSong(i) {
    S.song = (i + SONGS.length) % SONGS.length; S.pos = 0; S.liked = false; S.playing = true;
    const art = $("pArt"); art.classList.remove("swap"); void art.offsetWidth; art.classList.add("swap");
    renderPlayer(); renderStrip(); renderBar();
  }
  $("pPlay").onclick = () => { S.playing = !S.playing; renderPlayer(); renderStrip(); renderBar(); };
  $("pNext").onclick = () => setSong(S.shuffle ? Math.floor(Math.random() * SONGS.length) : S.song + 1);
  $("pPrev").onclick = () => (S.pos > 5 ? (S.pos = 0, renderPlayer()) : setSong(S.song - 1));
  $("pLike").onclick = () => { S.liked = !S.liked; renderPlayer(); };
  $("pShuffle").onclick = () => { S.shuffle = !S.shuffle; renderPlayer(); };
  $("pVolBtn").onclick = () => { S.volOpen = !S.volOpen; placeButtons(); };
  const setVol = (e) => { const r = $("pVol").getBoundingClientRect(); S.vol = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100); placeButtons(); renderMenu(); };
  $("pVol").onpointerdown = (e) => { $("pVol").setPointerCapture(e.pointerId); setVol(e); };
  $("pVol").onpointermove = (e) => { if (e.buttons) setVol(e); };
  $("pTrack").onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); S.pos = Math.round((e.clientX - r.left) / r.width * SONGS[S.song].d); renderPlayer(); };
  (function wave() { phase += .08; if (S.layer === "media" && S.playing) drawWave(); requestAnimationFrame(wave); })();

  function renderAnswer() { $("aQ").textContent = "You asked: " + S.answer.q; $("aT").textContent = S.answer.t; $("aM").textContent = S.answer.m; }

  // ---------------------------------------------------------------- the Command Center
  const ICON = {
    mic: '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    clip: '<rect x="3" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 10l5-3v10l-5-3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    show: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18" stroke="currentColor" stroke-width="1.8"/>',
    chat: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const TILES = [["mic", "Microphone"], ["night", "Night light"], ["clip", "Save clip"], ["show", "Open Jyson"], ["chat", "New chat"], ["gear", "Settings"]];
  const QUICK = [["autohide", "Auto-hide"], ["voice", "Read aloud"], ["focus", "Focus"], ["bar", "Jyson bar"]];
  function renderMenu() {
    if (!$("tiles").children.length) {              // built once; later only the on/off colour changes (so it fades)
      $("tiles").innerHTML = TILES.map(([k, l]) => `<button class="tile" data-k="${k}"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${l}</button>`).join("");
      $("quick").innerHTML = $("quick2").innerHTML = QUICK.map(([k, l]) => `<button class="qp" data-q="${k}">${l}</button>`).join("");
    }
    const on = { mic: S.mic, night: S.night, show: !$("win").classList.contains("hidden") };
    for (const t of $("tiles").children) t.classList.toggle("on", !!on[t.dataset.k]);
    for (const p of document.querySelectorAll(".qp")) p.classList.toggle("on", !!S[p.dataset.q]);
    for (const id of ["sVol", "qVol"]) $(id).value = S.vol;
    for (const id of ["sBright", "qBright"]) $(id).value = S.bright;
    $("sVolV").textContent = $("qVolV").textContent = S.vol + "%";
    $("sBrightV").textContent = $("qBrightV").textContent = S.bright + "%";
  }
  function applyScreen() {
    $("night").classList.toggle("on", S.night);
    $("dim").style.opacity = ((100 - S.bright) / 100 * .78).toFixed(3);
    $("bar").classList.toggle("off", !S.bar);
    renderBar();
  }
  function tile(k) {
    if (k === "mic") { S.mic = !S.mic; card(CI.mic, S.mic ? "Microphone on" : "Microphone off", S.mic ? 'Jyson listens for "Hey Jyson" again' : "Jyson doesn't listen until you switch it back on"); }
    if (k === "night") S.night = !S.night;
    if (k === "clip") saveClip();
    if (k === "show") $("win").classList.toggle("hidden");
    if (k === "chat") { $("win").classList.remove("hidden"); $("chat").innerHTML = ""; $("winTitle").textContent = "New chat"; setLayer(null); }
    if (k === "gear") { $("win").classList.remove("hidden"); $("winTitle").textContent = "Settings"; setLayer(null);
      $("chat").innerHTML = '<div class="msg ai">Settings opens here: Account, AI, Voice &amp; Audio, Jyson Mochi, Taskbar, Gaming, Phone link.</div>'; }
    renderMenu(); applyScreen();
  }
  function quick(k) { S[k] = !S[k]; renderMenu(); applyScreen(); autohide(); }
  screen.addEventListener("click", (e) => {
    const t = e.target.closest("[data-k]"); if (t) { touched = true; tile(t.dataset.k); }
    const q = e.target.closest("[data-q]"); if (q) { touched = true; quick(q.dataset.q); }
    const a = e.target.closest("[data-app]"); if (a) openApp(a.dataset.app);
  });
  for (const id of ["sVol", "qVol"]) $(id).oninput = (e) => { S.vol = +e.target.value; renderMenu(); placeButtons(); };
  for (const id of ["sBright", "qBright"]) $(id).oninput = (e) => { S.bright = +e.target.value; renderMenu(); applyScreen(); };

  // ---------------------------------------------------------------- the Jyson bar (docked, the default layout)
  const APPS = {
    browser: { n: "Browser", svg: '<circle cx="12" cy="12" r="9" fill="#2f7cf6"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="#bfe0ff" stroke-width="1.4" fill="none"/>' },
    files: { n: "Files", svg: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1H3z" fill="#e3a72f"/><rect x="3" y="9" width="18" height="11" rx="2" fill="#f6c443"/>' },
    jyson: { n: "Jyson", vb: "0 0 256 256", svg: LOGO },
    music: { n: "Music", svg: '<circle cx="12" cy="12" r="9" fill="#1fb85b"/><path d="M7.5 9.5c3-1 6-.8 9 .6M8 12.5c2.6-.8 5-.6 7.6.6M8.6 15.3c2-.5 4-.4 6 .5" stroke="#06200f" stroke-width="1.5" fill="none" stroke-linecap="round"/>' },
    chat: { n: "Chat", svg: '<rect x="3" y="4" width="18" height="14" rx="5" fill="#6d72f6"/><circle cx="9" cy="11" r="1.6" fill="#fff"/><circle cx="15" cy="11" r="1.6" fill="#fff"/><path d="M8 18l-2 3 5-3" fill="#6d72f6"/>' },
    game: { n: "Game", svg: '<rect x="2" y="7" width="20" height="11" rx="5.5" fill="#e0525e"/><path d="M7 10v5M4.5 12.5h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.5" cy="11.5" r="1.2" fill="#fff"/><circle cx="18" cy="13.5" r="1.2" fill="#fff"/>' },
  };
  const svg = (inner, s = 24, vb = "0 0 24 24") => `<svg viewBox="${vb}" width="${s}" height="${s}">${inner}</svg>`;
  const appSvg = (a, s = 24) => svg(APPS[a].svg, s, APPS[a].vb);
  // the default order: media | start, search, apps | tray, weather, CPU, quick settings, clock
  function renderBar() {
    const front = $("win").classList.contains("hidden") ? "" : "jyson";
    const apps = narrow ? ["browser", "files", "jyson", "music"] : ["browser", "files", "jyson", "music", "chat", "game"];
    const running = new Set(["browser", "jyson", "music", "chat"]);
    const shape = [narrow, S.focus, front].join("|");   // rebuilt only when its shape changes, so hovers don't jump
    const bar = $("bar");
    if (bar._shape !== shape) {
      bar._shape = shape;
      bar.innerHTML = [
        !narrow ? `<div class="tb np"><button class="np-open" id="npOpen" aria-label="Open the player"><span class="np-cover" id="npC"></span>` +
          '<span class="np-info"><b id="npT"></b><span class="np-prog"><small id="npE"></small><span class="np-track"><i id="npF"></i></span><small id="npR"></small></span></span></button>' +
          `<button class="np-b" id="npPrev" aria-label="Previous song">${svg('<path d="M6 5h2.5v14H6zM20 5v14L9 12z" fill="#e6e9ed"/>', 14)}</button>` +
          '<button class="np-b big" id="npPlay" aria-label="Play or pause"></button>' +
          `<button class="np-b" id="npNext" aria-label="Next song">${svg('<path d="M15.5 5H18v14h-2.5zM4 5l11 7-11 7z" fill="#e6e9ed"/>', 14)}</button></div><span class="bsep"></span>` : "",
        `<button class="tb app" id="startBtn" aria-label="Start">${svg('<rect x="3" y="3" width="8" height="8" rx="2" fill="#9fc3ff"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#9fc3ff"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#9fc3ff"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#9fc3ff"/>')}</button>`,
        `<button class="tb app" aria-label="Search">${svg('<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="#e6e9ed" stroke-width="2"/><path d="M15 15l5 5" stroke="#e6e9ed" stroke-width="2" stroke-linecap="round"/>', 20)}</button>`,
        ...apps.map((a) => `<button class="tb app ${running.has(a) ? "run" : ""} ${front === a ? "front" : ""} ${S.focus && (a === "chat" || a === "game") ? "dimmed" : ""}" data-app="${a}" aria-label="${APPS[a].n}">${appSvg(a)}</button>`),
        '<span class="bsep"></span>',
        `<button class="tb" aria-label="Hidden icons">${svg('<path d="M7 14l5-5 5 5" stroke="#cfd6de" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 16)}</button>`,
        !narrow ? `<span class="tb">${svg('<path d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.8A3.2 3.2 0 0 0 7 19z" fill="#e6e9ed"/>', 22)}<span class="txt"><b>4°</b><small>4° / 2°</small></span></span>` : "",
        !narrow ? '<span class="tb"><span class="txt"><b id="bCpu"></b><small id="bRam"></small></span></span>' : "",
        `<button class="tb" id="qsBtn" aria-label="Quick settings">${svg('<path d="M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M10 16.5a3 3 0 0 1 4 0" stroke="#e6e9ed" stroke-width="1.8" fill="none" stroke-linecap="round"/>', 18)}${svg('<path d="M4 9v6h4l5 4V5L8 9z" fill="#e6e9ed"/>', 18)}</button>`,
        '<span class="tb"><span class="txt r"><b id="bClock"></b><small id="bDate"></small></span></span>',
      ].join("");
      bindBar();
    }
    const song = SONGS[S.song];
    if ($("npT")) {
      $("npC").style.background = grad(song.c); $("npT").textContent = `${song.a} - ${plainTitle(song.t)}`;
      $("npE").textContent = mmss(S.pos); $("npR").textContent = "-" + mmss(Math.max(0, song.d - S.pos));
      $("npF").style.width = (100 * S.pos / song.d).toFixed(2) + "%"; $("npPlay").innerHTML = S.playing ? PAUSE : PLAY;
    }
    if ($("bCpu")) { $("bCpu").textContent = `CPU ${S.cpu}%`; $("bRam").textContent = `RAM ${S.ram}%`; }
    const d = new Date();
    $("bClock").textContent = clock();
    $("bDate").textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function bindBar() {
    if ($("npPlay")) {
      $("npPlay").onclick = () => { touched = true; S.playing = !S.playing; renderPlayer(); renderStrip(); renderBar(); };
      $("npNext").onclick = () => { touched = true; setSong(S.song + 1); };
      $("npPrev").onclick = () => { touched = true; S.pos > 5 ? (S.pos = 0, renderPlayer(), renderBar()) : setSong(S.song - 1); };
      $("npOpen").onclick = () => { touched = true; setLayer("media"); };
    }
    $("qsBtn").onclick = () => { touched = true; renderMenu(); $("qs").classList.toggle("show"); $("start").classList.remove("show"); };
    $("startBtn").onclick = () => { touched = true; $("start").classList.toggle("show"); $("qs").classList.remove("show"); };
  }
  function openApp(a) {
    touched = true;
    if (a === "jyson") { tile("show"); return; }
    if (a === "music") { setLayer("media"); return; }
    card(appSvg(a, 18), APPS[a].n, "Opens on your PC - this page only shows Jyson");
  }
  $("sGrid").innerHTML = Object.keys(APPS).map((k) => `<button class="s-app" data-app="${k}">${appSvg(k, 28)}${APPS[k].n}</button>`).join("") +
    `<button class="s-app" data-k="gear">${svg('<circle cx="12" cy="12" r="9" fill="#5f6b7a"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="1.8"/>', 28)}Settings</button>` +
    `<button class="s-app" data-app="files">${svg('<rect x="4" y="3" width="16" height="18" rx="3" fill="#3e5f9e"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>', 28)}Notes</button>` +
    `<button class="s-app" data-app="files">${svg('<rect x="3" y="5" width="18" height="15" rx="3" fill="#2f9e65"/><path d="M3 9h18M8 3v4M16 3v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>', 28)}Calendar</button>` +
    `<button class="s-app" data-app="files">${svg('<rect x="3" y="5" width="18" height="14" rx="3" fill="#2a3442"/><path d="M10 9l5 3-5 3z" fill="#7fa8ff"/>', 28)}Clips</button>`;

  // ---------------------------------------------------------------- the card under Mochi, the halo, hiding
  let cardTimer = 0;
  function card(icon, title, text, buttons = [], seconds = 4.2) {
    const el = $("card");
    el.classList.remove("show"); void el.offsetWidth;            // a new card grows out again
    el.style.top = ((parseInt(mochi.style.height) || 30) + 8) + "px";   // under whatever Mochi shows now
    el.innerHTML = `<span class="c-ic">${icon}</span><span class="c-txt"><b>${title}</b><span>${text}</span></span>` +
      buttons.map((b, i) => `<button class="c-btn ${i === 0 ? "p" : ""}">${b}</button>`).join("");
    el.classList.add("show"); clearTimeout(cardTimer);
    for (const b of el.querySelectorAll(".c-btn")) b.onclick = () => { el.classList.remove("show"); S.busy = false; autohide(); };
    S.busy = true; autohide();
    cardTimer = setTimeout(() => { el.classList.remove("show"); S.busy = false; autohide(); }, seconds * 1000);
  }
  function halo(sec) { mochi.classList.add("halo"); setTimeout(() => mochi.classList.remove("halo"), sec * 1000); }
  function autohide() {
    const wanted = !S.autohide || S.layer || S.hover || S.busy || S.timer || S.listening || S.edge;
    mochi.classList.toggle("hide", !wanted);
  }
  screen.addEventListener("pointermove", (e) => {
    const r = screen.getBoundingClientRect(), edge = (e.clientY - r.top) / r.height < .035;
    if (edge !== S.edge) { S.edge = edge; autohide(); }
  });
  let tipTimer = 0;
  function showTip() { if (narrow || matchMedia("(hover: none)").matches) return; $("tip").classList.add("show"); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 3800); }
  function hideTip() { $("tip").classList.remove("show"); }

  // ---------------------------------------------------------------- things to try
  function saveClip() { halo(1.2); card(CI.clip, "Clip saving", "The last 30 seconds", [], 1.2); setTimeout(() => card(CI.clip, "Clip saved", "Jyson clip · 30 s · 41 MB", ["Open"]), 1100); }
  function screenshot() {
    const flash = document.createElement("div");
    flash.style.cssText = "position:absolute;inset:0;background:#fff;z-index:70;opacity:.75;transition:opacity .5s ease;pointer-events:none";
    screen.appendChild(flash); requestAnimationFrame(() => (flash.style.opacity = "0")); setTimeout(() => flash.remove(), 600);
    card(CI.shot, "Screenshot saved", "Screenshot 2026-11-20 18.20.png", ["Open", "Show in folder"]);
  }
  function startTimer(sec) { S.timer = { end: Date.now() + sec * 1000, total: sec }; setLayer(null); renderStrip(); autohide(); }
  function voice() {
    S.listening = true; S.peek = false; setLayer(null); renderStrip(); autohide(); halo(1.9);
    setTimeout(() => {
      S.listening = false;
      const q = "What's using my CPU right now?", t = "Your browser, at 9%. Everything else is under 2%, so nothing to worry about.";
      S.answer = { q, t, m: "Spoken aloud · Gemini · 1.1 s" };
      $("win").classList.remove("hidden"); $("winTitle").textContent = "CPU check";
      $("chat").innerHTML = `<div class="msg you">${q}</div><div class="msg ai">${t}<small>Spoken aloud · Gemini</small></div>`;
      card(CI.j, "Jyson", "Your browser, at 9%. Turn the wheel for the whole answer."); renderStrip(); renderBar();
    }, 1900);
  }
  const act = (fn) => () => { touched = true; fn(); };
  $("tryVoice").onclick = act(voice);
  $("tryTimer").onclick = act(() => startTimer(60));
  $("tryClip").onclick = act(saveClip);
  $("tryShot").onclick = act(screenshot);
  $("tryNext").onclick = act(() => setSong(S.song + 1));
  $("tryNight").onclick = act(() => tile("night"));
  $("tPeek").onclick = act(() => { S.peek = !S.peek; if (S.layer) setLayer(null); renderStrip(); });
  $("tDown").onclick = act(() => step(1));
  $("tUp").onclick = act(() => step(-1));
  addEventListener("keydown", (e) => { if (e.key === "F8") { e.preventDefault(); touched = true; saveClip(); } });

  // ---------------------------------------------------------------- the opening demo: Mochi shows what it does, once
  const demo = [
    [2400, () => { S.peek = true; renderStrip(); }],
    [4400, () => { S.peek = false; renderStrip(); }],
    [5600, () => startTimer(12)],
    [7600, () => setLayer("media")],
    [10600, () => setLayer(null)],
    [11400, () => showTip()],
  ];
  for (const [at, fn] of demo) setTimeout(() => { if (!touched) fn(); }, at);

  // ---------------------------------------------------------------- the clock, the song moving on, the load, the timer
  setInterval(() => {
    if (S.playing) { S.pos += 1; if (S.pos >= SONGS[S.song].d) setSong(S.song + 1); }
    S.cpu = Math.max(3, Math.min(38, S.cpu + Math.round((Math.random() - .5) * 6)));
    S.ram = Math.max(30, Math.min(70, S.ram + Math.round((Math.random() - .5) * 2)));
    if (S.timer && Date.now() >= S.timer.end) { S.timer = null; halo(4); card(CI.timer, "Time's up", "Your timer is done", ["Stop"]); }
    if (S.layer === "media") renderPlayer();
    if (!S.layer) renderStrip();
    renderBar();
  }, 1000);

  addEventListener("resize", fit);
  fit(); renderPlayer(); renderMenu(); applyScreen(); renderStrip();
})();
