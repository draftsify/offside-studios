// ---- Cozy hand-drawn street: a cute character walking (2D canvas, original art) ----
(function () {
  const canvas = document.getElementById("scene");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2), S = 1;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = Math.max(0.62, Math.min(1.5, H / 760));   // global scale
  }
  window.addEventListener("resize", resize); resize();

  const rnd = (i) => { const s = Math.sin(i * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // scrolling world position (character walks to the right; world slides left)
  let worldX = 0;
  const SPEED = 58;               // px/s of forward walk

  function tile(spacing, factor, cb) {
    const base = worldX * factor;
    let i = Math.floor(base / spacing) - 1;
    for (; ; i++) {
      const x = i * spacing - base;
      if (x > W + spacing) break;
      cb(x, i);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- sky ----------
  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#bfe0ef");
    g.addColorStop(0.45, "#dff0e6");
    g.addColorStop(0.75, "#f6ead0");
    g.addColorStop(1, "#f3dcc0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft sun glow
    const sx = W * 0.72, sy = H * 0.26, r = 150 * S;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, r);
    sg.addColorStop(0, "rgba(255,247,224,0.9)");
    sg.addColorStop(1, "rgba(255,247,224,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,251,238,0.95)";
    ctx.beginPath(); ctx.arc(sx, sy, 34 * S, 0, 7); ctx.fill();
  }

  function cloud(x, y, s, a) {
    ctx.fillStyle = "rgba(255,255,255," + a + ")";
    for (const [dx, dy, r] of [[0, 0, 26], [22, 4, 20], [-22, 4, 20], [10, -10, 18], [-10, -8, 16]]) {
      ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill();
    }
  }
  function clouds() {
    tile(360, 0.05, (x, i) => {
      const y = H * (0.14 + 0.12 * rnd(i * 3));
      cloud(x + 60, y, (0.8 + rnd(i) * 0.7) * S, 0.85);
    });
  }

  // ---------- distant hills ----------
  function hills(baseY, amp, col, factor, span) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-40, H);
    const base = worldX * factor;
    for (let x = -40; x <= W + 40; x += 14) {
      const p = (x + base) / span;
      const y = baseY - Math.abs(Math.sin(p)) * amp - Math.sin(p * 2.3) * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill();
  }

  // ---------- a cozy cottage ----------
  const WALLS = ["#f0d0a6", "#eac59a", "#f2d8b0", "#e7c49a"];
  const ROOFS = ["#c06a4f", "#7d9e6b", "#6f8fb0", "#b7794f", "#9a6b8f"];
  function house(x, i, groundY) {
    const w = (150 + rnd(i) * 70) * S;
    const h = (120 + rnd(i * 2) * 90) * S;
    const y = groundY - h;
    const wall = WALLS[i % WALLS.length];
    const roof = ROOFS[(i * 3) % ROOFS.length];
    // wall
    ctx.fillStyle = wall;
    roundRect(x, y, w, h, 8 * S); ctx.fill();
    ctx.strokeStyle = "rgba(90,60,40,0.25)"; ctx.lineWidth = 2 * S; ctx.stroke();
    // roof (overhanging)
    const oh = 16 * S, rh = 46 * S;
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - oh, y + 6 * S);
    ctx.lineTo(x + w / 2, y - rh);
    ctx.lineTo(x + w + oh, y + 6 * S);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(70,45,35,0.28)"; ctx.stroke();
    // chimney + smoke
    if (rnd(i * 5) > 0.45) {
      const cxp = x + w * 0.72;
      ctx.fillStyle = roof; ctx.fillRect(cxp, y - rh * 0.55, 12 * S, 26 * S);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let k = 0; k < 3; k++) {
        const t = (worldX * 0.02 + i + k * 0.6);
        ctx.beginPath();
        ctx.arc(cxp + 6 * S + Math.sin(t) * 6 * S, y - rh * 0.55 - k * 12 * S - 6 * S, (4 + k * 2) * S, 0, 7);
        ctx.fill();
      }
    }
    // windows (warm glow)
    const wins = w > 170 * S ? 2 : 1;
    for (let k = 0; k < wins; k++) {
      const wx = x + w * (wins === 1 ? 0.5 : 0.3 + k * 0.4) - 15 * S;
      const wy = y + h * 0.28;
      ctx.fillStyle = "#ffd98a";
      roundRect(wx, wy, 30 * S, 34 * S, 4 * S); ctx.fill();
      ctx.strokeStyle = "#8a5a3b"; ctx.lineWidth = 3 * S; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wx + 15 * S, wy); ctx.lineTo(wx + 15 * S, wy + 34 * S);
      ctx.moveTo(wx, wy + 17 * S); ctx.lineTo(wx + 30 * S, wy + 17 * S); ctx.stroke();
    }
    // door
    ctx.fillStyle = "#8a5a3b";
    roundRect(x + w * 0.5 - 16 * S, groundY - 52 * S, 32 * S, 52 * S, 6 * S); ctx.fill();
    ctx.fillStyle = "#ffcf7a";
    ctx.beginPath(); ctx.arc(x + w * 0.5 + 8 * S, groundY - 26 * S, 2.5 * S, 0, 7); ctx.fill();
  }

  // ---------- tree ----------
  function tree(x, i, groundY, sc) {
    const s = (0.8 + rnd(i) * 0.6) * sc * S;
    ctx.fillStyle = "#7a5638";
    ctx.fillRect(x - 6 * s, groundY - 60 * s, 12 * s, 62 * s);
    const blobs = [[0, -78, 40], [-30, -60, 30], [30, -60, 30], [-16, -96, 28], [18, -96, 28]];
    ctx.fillStyle = i % 2 ? "#6f9e52" : "#7fae5a";
    for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(x + dx * s, groundY + dy * s, r * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.arc(x - 12 * s, groundY - 92 * s, 20 * s, 0, 7); ctx.fill();
  }

  // ---------- foreground props ----------
  function lamppost(x, groundY) {
    ctx.strokeStyle = "#3f3a44"; ctx.lineWidth = 6 * S; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 150 * S);
    ctx.lineTo(x + 24 * S, groundY - 150 * S); ctx.stroke();
    const lx = x + 26 * S, ly = groundY - 146 * S;
    const gg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34 * S);
    gg.addColorStop(0, "rgba(255,224,150,0.8)"); gg.addColorStop(1, "rgba(255,224,150,0)");
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(lx, ly, 34 * S, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffdd8a"; ctx.beginPath(); ctx.arc(lx, ly, 7 * S, 0, 7); ctx.fill();
  }
  function bush(x, groundY, sc) {
    const s = sc * S;
    ctx.fillStyle = "#5f8f45";
    for (const [dx, dy, r] of [[0, 0, 26], [24, 4, 20], [-24, 4, 20], [10, -12, 18]]) {
      ctx.beginPath(); ctx.arc(x + dx * s, groundY + dy * s, r * s, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#ffd24a";
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + (rnd(x + k) - 0.5) * 44 * s, groundY - rnd(k + 1) * 12 * s, 2.6 * s, 0, 7); ctx.fill(); }
  }

  // ---------- ground ----------
  function ground(groundY) {
    ctx.fillStyle = "#c9a878"; ctx.fillRect(0, groundY, W, H - groundY);          // dirt lane
    ctx.fillStyle = "#a7c56a"; ctx.fillRect(0, groundY - 10 * S, W, 14 * S);       // grass edge
    // grass tufts (foreground scroll)
    ctx.strokeStyle = "#8fb257"; ctx.lineWidth = 3 * S; ctx.lineCap = "round";
    tile(26, 1, (x) => {
      const gy = groundY + 2 * S;
      ctx.beginPath();
      ctx.moveTo(x, gy); ctx.lineTo(x - 3 * S, gy - 10 * S);
      ctx.moveTo(x, gy); ctx.lineTo(x + 3 * S, gy - 11 * S);
      ctx.moveTo(x, gy); ctx.lineTo(x, gy - 13 * S); ctx.stroke();
    });
    // cobble hints on the lane
    ctx.strokeStyle = "rgba(120,90,60,0.18)"; ctx.lineWidth = 2 * S;
    tile(60, 1, (x, i) => {
      const yy = groundY + 26 * S + (i % 2) * 18 * S;
      ctx.beginPath(); ctx.arc(x, yy, 16 * S, Math.PI, 2 * Math.PI); ctx.stroke();
    });
  }

  // ---------- the cute character ----------
  function character(cx, groundY, phase) {
    const sc = 1.45 * S;
    const bob = Math.abs(Math.sin(phase)) * 5 * sc;
    const y = groundY - bob;
    const legLen = 22 * sc, torsoH = 26 * sc, R = 30 * sc;
    const hipY = y - legLen, shY = hipY - torsoH, headY = shY - R + 8 * sc;
    const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);

    // ---- soft shadow ----
    ctx.fillStyle = "rgba(60,45,30,0.16)";
    ctx.beginPath(); ctx.ellipse(cx + 4 * sc, groundY + 4 * sc, 30 * sc, 8 * sc, 0, 0, 7); ctx.fill();

    function limb(x0, y0, ang, l1, l2, col, w, foot) {
      const kx = x0 + Math.sin(ang) * l1, ky = y0 + Math.cos(ang) * l1;
      const bend = ang * 0.5 + 0.15;
      const ex = kx + Math.sin(bend) * l2, ey = ky + Math.cos(bend) * l2;
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      if (foot) { ctx.fillStyle = foot; ctx.beginPath(); ctx.ellipse(ex + 3 * sc, ey, 8 * sc, 5 * sc, 0, 0, 7); ctx.fill(); }
      return [ex, ey];
    }

    // ---- far leg / far arm (behind body) ----
    limb(cx - 3 * sc, hipY, sw2 * 0.5, legLen * 0.55, legLen * 0.6, "#3f6f78", 11 * sc, "#6b4a34");
    limb(cx, shY + 4 * sc, sw * 0.6 + 0.1, 15 * sc, 13 * sc, "#e7b48f", 8 * sc, null);

    // ---- torso (overalls) ----
    ctx.fillStyle = "#4f8a94";
    roundRect(cx - 17 * sc, shY, 34 * sc, torsoH + 8 * sc, 12 * sc); ctx.fill();
    ctx.fillStyle = "#f4e7cf"; // collar
    roundRect(cx - 13 * sc, shY - 2 * sc, 26 * sc, 10 * sc, 5 * sc); ctx.fill();

    // ---- near leg / near arm ----
    limb(cx + 3 * sc, hipY, sw * 0.55, legLen * 0.55, legLen * 0.62, "#4f8a94", 12 * sc, "#7a5638");
    const hand = limb(cx + 2 * sc, shY + 4 * sc, sw2 * 0.6 + 0.1, 15 * sc, 13 * sc, "#f3caa4", 9 * sc, null);

    // ---- satchel ----
    ctx.strokeStyle = "#b98a4a"; ctx.lineWidth = 4 * sc;
    ctx.beginPath(); ctx.moveTo(cx - 14 * sc, shY + 2 * sc); ctx.lineTo(cx + 14 * sc, shY + 20 * sc); ctx.stroke();
    ctx.fillStyle = "#caa05a";
    roundRect(cx + 10 * sc, shY + 16 * sc, 18 * sc, 16 * sc, 4 * sc); ctx.fill();

    // ---- head ----
    ctx.fillStyle = "#f3caa4";
    ctx.beginPath(); ctx.arc(cx, headY, R, 0, 7); ctx.fill();
    // hair (cute cap of hair)
    ctx.fillStyle = "#5b3a29";
    ctx.beginPath();
    ctx.arc(cx, headY - 3 * sc, R + 1 * sc, Math.PI * 1.03, Math.PI * 2.0, false);
    ctx.lineTo(cx + R * 0.9, headY - 2 * sc);
    ctx.quadraticCurveTo(cx, headY - R * 1.15, cx - R * 0.95, headY - 2 * sc);
    ctx.fill();
    // little tuft
    ctx.beginPath(); ctx.arc(cx + R * 0.1, headY - R + 2 * sc, 6 * sc, 0, 7); ctx.fill();
    // face
    ctx.fillStyle = "#3a2a20";
    ctx.beginPath(); ctx.arc(cx + 8 * sc, headY - 1 * sc, 3.1 * sc, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 22 * sc, headY - 1 * sc, 3.1 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(240,150,140,0.65)";
    ctx.beginPath(); ctx.arc(cx + 6 * sc, headY + 9 * sc, 4.5 * sc, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 24 * sc, headY + 9 * sc, 4.5 * sc, 0, 7); ctx.fill();
    ctx.strokeStyle = "#a05a44"; ctx.lineWidth = 2.4 * sc; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx + 15 * sc, headY + 6 * sc, 6 * sc, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  // ---------- light motes ----------
  const motes = Array.from({ length: 26 }, (_, i) => ({ x: rnd(i) * 1600, y: rnd(i + 9) * 900, r: 1 + rnd(i + 3) * 2.4, s: 0.3 + rnd(i + 5) * 0.7 }));
  function drawMotes(t) {
    ctx.fillStyle = "rgba(255,248,220,0.7)";
    for (const m of motes) {
      const x = (m.x - worldX * m.s * 0.15) % (W + 40); const px = x < 0 ? x + W + 40 : x;
      const y = (m.y + Math.sin(t * 0.4 + m.x) * 12) % H;
      ctx.beginPath(); ctx.arc(px, (y + H) % H, m.r * S, 0, 7); ctx.fill();
    }
  }

  // ---------- frame ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    worldX += SPEED * dt;
    const t = now / 1000;
    const groundY = H * 0.80;

    sky();
    clouds();
    hills(groundY - 40 * S, 90 * S, "#bcd6c2", 0.14, 260);
    hills(groundY - 6 * S, 70 * S, "#a9cba0", 0.22, 200);
    // houses row (mid)
    tile(230 * S, 0.42, (x, i) => house(x, i, groundY + 2 * S));
    // trees between/in front of houses
    tile(300 * S, 0.5, (x, i) => tree(x + 120 * S, i, groundY + 4 * S, 1));
    ground(groundY);
    // foreground greenery + lamps
    tile(340 * S, 0.92, (x, i) => {
      if (i % 3 === 0) lamppost(x, groundY + 6 * S);
      else bush(x + 40 * S, groundY + 10 * S, 0.9 + rnd(i) * 0.5);
    });

    // character walks at a fixed spot; steps sync to the scroll
    character(W * 0.42, groundY + 6 * S, worldX * 0.10);

    drawMotes(t);

    // warm vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(60,40,20,0.14)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
