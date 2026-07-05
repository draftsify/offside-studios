// ---- Hand-painted 2D storybook street with a cute walking character (canvas) ----
(function () {
  const canvas = document.getElementById("scene");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2), S = 1;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = Math.max(0.6, Math.min(1.5, H / 760));
  }
  window.addEventListener("resize", resize); resize();

  const rnd = (i) => { const s = Math.sin(i * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s); };

  // paper-grain texture (built once)
  const noise = document.createElement("canvas");
  noise.width = noise.height = 180;
  (() => {
    const nc = noise.getContext("2d");
    const img = nc.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.floor(Math.random() * 135);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    nc.putImageData(img, 0, 0);
  })();

  let worldX = 0;
  const SPEED = 54;

  function tile(spacing, factor, cb) {
    const base = worldX * factor;
    let i = Math.floor(base / spacing) - 1;
    for (; ; i++) { const x = i * spacing - base; if (x > W + spacing) break; cb(x, i); }
  }

  // organic hand-drawn blob path (irregular edges + smoothing)
  function blob(cx, cy, r, seed, wob, squash) {
    squash = squash || 1;
    const N = 13, pts = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const rr = r * (1 + wob * (rnd(seed * 9.7 + k) - 0.5) * 2);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[0][0] + pts[N - 1][0]) / 2, (pts[0][1] + pts[N - 1][1]) / 2);
    for (let k = 0; k < N; k++) {
      const p = pts[k], q = pts[(k + 1) % N];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function ink(w) { ctx.strokeStyle = "rgba(70,52,40,0.32)"; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.stroke(); }

  // ---------- sky ----------
  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#a9d3e6");
    g.addColorStop(0.42, "#cfe6dc");
    g.addColorStop(0.72, "#f2e6c6");
    g.addColorStop(1, "#f6ecd2");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sx = W * 0.74, sy = H * 0.24, r = 170 * S;
    const sg = ctx.createRadialGradient(sx, sy, 8, sx, sy, r);
    sg.addColorStop(0, "rgba(255,248,226,0.95)"); sg.addColorStop(1, "rgba(255,248,226,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,252,242,0.9)"; ctx.beginPath(); ctx.arc(sx, sy, 30 * S, 0, 7); ctx.fill();
    // horizon haze
    const hz = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.82);
    hz.addColorStop(0, "rgba(246,236,214,0)"); hz.addColorStop(1, "rgba(246,236,214,0.7)");
    ctx.fillStyle = hz; ctx.fillRect(0, H * 0.55, W, H * 0.3);
  }

  function clouds() {
    ctx.save(); ctx.filter = "blur(" + (2 * S) + "px)";
    tile(420, 0.05, (x, i) => {
      const cx = x + 80, cy = H * (0.13 + 0.1 * rnd(i * 3)), s = (0.9 + rnd(i) * 0.7) * S;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (const [dx, dy, r] of [[0, 0, 30], [26, 6, 22], [-26, 6, 22], [12, -12, 20], [-12, -10, 18]])
        { blob(cx + dx * s, cy + dy * s, r * s, i + dx, 0.18, 0.85); ctx.fill(); }
      ctx.fillStyle = "rgba(240,225,235,0.5)";
      blob(cx, cy + 10 * s, 30 * s, i + 5, 0.14, 0.5); ctx.fill();
    });
    ctx.restore();
  }

  function hills(baseY, amp, col, factor, span, blur) {
    ctx.save(); if (blur) ctx.filter = "blur(" + (blur * S) + "px)";
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-40, H);
    const base = worldX * factor;
    for (let x = -40; x <= W + 40; x += 12) {
      const p = (x + base) / span;
      const y = baseY - Math.abs(Math.sin(p)) * amp - Math.sin(p * 2.7 + 1) * amp * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ---------- painted foliage ----------
  function canopy(cx, cy, r, seed) {
    ctx.fillStyle = "#456e39"; blob(cx, cy + r * 0.12, r * 1.02, seed, 0.16); ctx.fill(); ink(2 * S);
    ctx.fillStyle = "#5d8c42"; blob(cx, cy, r, seed + 1, 0.18); ctx.fill();
    const dabs = Math.floor(r / 7) + 9;
    for (let k = 0; k < dabs; k++) {
      const a = rnd(seed + k * 1.7) * Math.PI * 2, rad = Math.sqrt(rnd(seed + k * 2.3)) * r * 0.82;
      const dx = Math.cos(a) * rad, dy = Math.sin(a) * rad * 0.92;
      const up = (-dy - dx * 0.4) / r;
      ctx.fillStyle = up > 0.45 ? "#b2d67e" : up > 0.05 ? "#83b657" : "#527f3b";
      blob(cx + dx, cy + dy, r * 0.17 * (0.7 + rnd(seed + k) * 0.7), seed + k * 5, 0.34); ctx.fill();
    }
  }
  function tree(x, i, groundY) {
    const s = (0.9 + rnd(i) * 0.6);
    ctx.fillStyle = "#6f4d35"; roundRect(x - 6 * s * S, groundY - 64 * s * S, 12 * s * S, 66 * s * S, 4 * S); ctx.fill(); ink(2 * S);
    ctx.fillStyle = "rgba(150,110,80,0.5)"; ctx.fillRect(x - 1 * s * S, groundY - 60 * s * S, 3 * s * S, 56 * s * S);
    canopy(x, groundY - 84 * s * S, 46 * s * S, i * 2 + 1);
  }

  // ---------- cottages ----------
  const WALLS = ["#eecfa2", "#e8c497", "#f0d6ac", "#e6c193"];
  const ROOFS = ["#bd6a4f", "#7e9c66", "#6f8cae", "#b07a4c", "#986a8c"];
  function house(x, i, groundY) {
    const w = (160 + rnd(i) * 70) * S, h = (120 + rnd(i * 2) * 90) * S, y = groundY - h;
    ctx.fillStyle = WALLS[i % WALLS.length]; roundRect(x, y, w, h, 7 * S); ctx.fill();
    ctx.fillStyle = "rgba(120,80,50,0.12)"; ctx.fillRect(x + w * 0.62, y, w * 0.38, h); // shade side
    roundRect(x, y, w, h, 7 * S); ink(2 * S);
    const oh = 16 * S, rh = 48 * S, roof = ROOFS[(i * 3) % ROOFS.length];
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(x - oh, y + 6 * S); ctx.lineTo(x + w / 2 + (rnd(i) - 0.5) * 10, y - rh); ctx.lineTo(x + w + oh, y + 6 * S); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.moveTo(x - oh, y + 6 * S); ctx.lineTo(x + w / 2, y - rh); ctx.lineTo(x + w / 2, y + 6 * S); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - oh, y + 6 * S); ctx.lineTo(x + w / 2, y - rh); ctx.lineTo(x + w + oh, y + 6 * S); ink(2 * S);
    if (rnd(i * 5) > 0.5) {
      const cxp = x + w * 0.72; ctx.fillStyle = roof; ctx.fillRect(cxp, y - rh * 0.5, 12 * S, 24 * S);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      for (let k = 0; k < 3; k++) { const t = worldX * 0.02 + i + k * 0.7; ctx.beginPath(); ctx.arc(cxp + 6 * S + Math.sin(t) * 6 * S, y - rh * 0.5 - k * 12 * S - 6 * S, (4 + k * 2) * S, 0, 7); ctx.fill(); }
    }
    const wins = w > 185 * S ? 2 : 1;
    for (let k = 0; k < wins; k++) {
      const wx = x + w * (wins === 1 ? 0.5 : 0.3 + k * 0.4) - 15 * S, wy = y + h * 0.3;
      ctx.fillStyle = "#ffd888"; roundRect(wx, wy, 30 * S, 34 * S, 4 * S); ctx.fill(); ink(3 * S);
      ctx.strokeStyle = "#7c5136"; ctx.lineWidth = 3 * S;
      ctx.beginPath(); ctx.moveTo(wx + 15 * S, wy); ctx.lineTo(wx + 15 * S, wy + 34 * S); ctx.moveTo(wx, wy + 17 * S); ctx.lineTo(wx + 30 * S, wy + 17 * S); ctx.stroke();
    }
    ctx.fillStyle = "#875637"; roundRect(x + w * 0.5 - 16 * S, groundY - 54 * S, 32 * S, 54 * S, 6 * S); ctx.fill(); ink(2 * S);
    ctx.fillStyle = "#ffcf7a"; ctx.beginPath(); ctx.arc(x + w * 0.5 + 8 * S, groundY - 28 * S, 2.5 * S, 0, 7); ctx.fill();
  }

  function bush(x, groundY, sc) {
    const s = sc * S;
    ctx.fillStyle = "#4c7a3b"; blob(x, groundY - 6 * s, 30 * s, x, 0.18, 0.8); ctx.fill(); ink(2 * S);
    ctx.fillStyle = "#5f974a"; blob(x - 6 * s, groundY - 12 * s, 24 * s, x + 2, 0.22, 0.85); ctx.fill();
    ctx.fillStyle = "#83b95d"; blob(x + 8 * s, groundY - 16 * s, 16 * s, x + 5, 0.28, 0.9); ctx.fill();
    ctx.fillStyle = "#ffd447"; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + (rnd(x + k) - 0.5) * 48 * s, groundY - 6 * s - rnd(k + 1) * 16 * s, 2.7 * s, 0, 7); ctx.fill(); }
  }
  function lamppost(x, groundY) {
    ctx.strokeStyle = "#3c3540"; ctx.lineWidth = 6 * S; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY - 155 * S); ctx.lineTo(x + 24 * S, groundY - 155 * S); ctx.stroke();
    const lx = x + 26 * S, ly = groundY - 150 * S, gg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 40 * S);
    gg.addColorStop(0, "rgba(255,226,150,0.85)"); gg.addColorStop(1, "rgba(255,226,150,0)");
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(lx, ly, 40 * S, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffdd8a"; ctx.beginPath(); ctx.arc(lx, ly, 7 * S, 0, 7); ctx.fill();
  }

  // ---------- painted ground ----------
  function ground(groundY) {
    const g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, "#cdad7c"); g.addColorStop(1, "#b8955f");
    ctx.fillStyle = g; ctx.fillRect(0, groundY, W, H - groundY);
    // dirt dabs (texture)
    tile(46, 1, (x, i) => {
      ctx.fillStyle = rnd(i) > 0.5 ? "rgba(150,116,74,0.35)" : "rgba(220,196,150,0.35)";
      const yy = groundY + 22 * S + rnd(i * 2) * (H - groundY - 30 * S);
      blob(x, yy, (5 + rnd(i) * 7) * S, i, 0.4, 0.6); ctx.fill();
    });
    // grass verge
    ctx.fillStyle = "#8fb257"; blob(-20, groundY, W, groundY, 0.0, 1); // fallback
    ctx.fillStyle = "#8fb257"; ctx.fillRect(0, groundY - 12 * S, W, 16 * S);
    ctx.strokeStyle = "#6f9a3f"; ctx.lineWidth = 3 * S; ctx.lineCap = "round";
    tile(16, 1, (x) => {
      const gy = groundY + 2 * S;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - 3 * S, gy - 12 * S);
      ctx.moveTo(x, gy); ctx.lineTo(x + 3 * S, gy - 13 * S); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 15 * S); ctx.stroke();
    });
  }

  // ---------- the cute character (painted, cel-shaded) ----------
  function character(cx, groundY, phase) {
    const sc = 1.5 * S;
    const bob = Math.abs(Math.sin(phase)) * 5 * sc, y = groundY - bob;
    const legLen = 22 * sc, torsoH = 26 * sc, R = 30 * sc;
    const hipY = y - legLen, shY = hipY - torsoH, headY = shY - R + 8 * sc;
    const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);

    ctx.fillStyle = "rgba(60,45,30,0.18)";
    ctx.beginPath(); ctx.ellipse(cx + 4 * sc, groundY + 4 * sc, 30 * sc, 8 * sc, 0, 0, 7); ctx.fill();

    function limb(x0, y0, ang, l1, l2, col, shade, w, foot) {
      const kx = x0 + Math.sin(ang) * l1, ky = y0 + Math.cos(ang) * l1;
      const bend = ang * 0.5 + 0.15, ex = kx + Math.sin(bend) * l2, ey = ky + Math.cos(bend) * l2;
      ctx.strokeStyle = "rgba(70,52,40,0.35)"; ctx.lineWidth = w + 3 * S; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      if (foot) { ctx.fillStyle = foot; ctx.beginPath(); ctx.ellipse(ex + 3 * sc, ey, 8 * sc, 5.5 * sc, 0, 0, 7); ctx.fill(); ink(2 * S); }
      return [ex, ey];
    }
    limb(cx - 3 * sc, hipY, sw2 * 0.5, legLen * 0.55, legLen * 0.6, "#31707a", "", 11 * sc, "#5f4230");
    limb(cx, shY + 4 * sc, sw * 0.6 + 0.1, 15 * sc, 13 * sc, "#e3b389", "", 8 * sc, null);

    // torso
    ctx.fillStyle = "#3f8894"; roundRect(cx - 17 * sc, shY, 34 * sc, torsoH + 8 * sc, 12 * sc); ctx.fill();
    ctx.fillStyle = "rgba(20,60,66,0.35)"; roundRect(cx + 2 * sc, shY, 15 * sc, torsoH + 8 * sc, 12 * sc); ctx.fill();
    roundRect(cx - 17 * sc, shY, 34 * sc, torsoH + 8 * sc, 12 * sc); ink(2.5 * S);
    ctx.fillStyle = "#f4e7cf"; roundRect(cx - 13 * sc, shY - 2 * sc, 26 * sc, 11 * sc, 5 * sc); ctx.fill(); ink(2 * S);

    limb(cx + 3 * sc, hipY, sw * 0.55, legLen * 0.55, legLen * 0.62, "#3f8894", "", 12 * sc, "#6f4d35");
    limb(cx + 2 * sc, shY + 4 * sc, sw2 * 0.6 + 0.1, 15 * sc, 13 * sc, "#f3caa4", "", 9 * sc, null);

    // satchel
    ctx.strokeStyle = "#b0834a"; ctx.lineWidth = 4 * sc;
    ctx.beginPath(); ctx.moveTo(cx - 14 * sc, shY + 2 * sc); ctx.lineTo(cx + 14 * sc, shY + 20 * sc); ctx.stroke();
    ctx.fillStyle = "#c39a54"; roundRect(cx + 10 * sc, shY + 16 * sc, 18 * sc, 16 * sc, 4 * sc); ctx.fill(); ink(2 * S);

    // head + outline
    ctx.fillStyle = "#f3caa4"; ctx.beginPath(); ctx.arc(cx, headY, R, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(210,150,110,0.28)"; ctx.beginPath(); ctx.arc(cx + 8 * sc, headY + 6 * sc, R, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, headY, R, 0, 7); ink(2.5 * S);
    // hair
    ctx.fillStyle = "#4f3524";
    ctx.beginPath();
    ctx.arc(cx, headY - 2 * sc, R + 1 * sc, Math.PI * 1.02, Math.PI * 2.0, false);
    ctx.quadraticCurveTo(cx, headY - R * 1.2, cx - R * 0.95, headY - 2 * sc); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + R * 0.12, headY - R + 2 * sc, 6 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.ellipse(cx - 8 * sc, headY - R * 0.7, 9 * sc, 5 * sc, -0.5, 0, 7); ctx.fill();
    // eyes (with highlight) + cheeks + smile
    ctx.fillStyle = "#3a2a20";
    ctx.beginPath(); ctx.arc(cx + 8 * sc, headY - 1 * sc, 3.6 * sc, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 22 * sc, headY - 1 * sc, 3.6 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx + 9.4 * sc, headY - 2.4 * sc, 1.3 * sc, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 23.4 * sc, headY - 2.4 * sc, 1.3 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(240,150,140,0.6)";
    ctx.beginPath(); ctx.arc(cx + 5 * sc, headY + 9 * sc, 4.6 * sc, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 25 * sc, headY + 9 * sc, 4.6 * sc, 0, 7); ctx.fill();
    ctx.strokeStyle = "#9a5340"; ctx.lineWidth = 2.6 * sc; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx + 15 * sc, headY + 6 * sc, 6 * sc, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  const motes = Array.from({ length: 22 }, (_, i) => ({ x: rnd(i) * 1700, y: rnd(i + 9) * 900, r: 1 + rnd(i + 3) * 2.2, s: 0.3 + rnd(i + 5) * 0.7 }));
  function drawMotes(t) {
    ctx.fillStyle = "rgba(255,248,220,0.75)";
    for (const m of motes) {
      let x = (m.x - worldX * m.s * 0.12) % (W + 40); if (x < 0) x += W + 40;
      const y = ((m.y + Math.sin(t * 0.5 + m.x) * 14) % H + H) % H;
      ctx.beginPath(); ctx.arc(x, y, m.r * S, 0, 7); ctx.fill();
    }
  }

  function grain() {
    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = "overlay";
    for (let x = 0; x < W; x += 180) for (let y = 0; y < H; y += 180) ctx.drawImage(noise, x, y);
    ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    worldX += SPEED * dt; const t = now / 1000; const groundY = H * 0.80;

    sky();
    clouds();
    hills(groundY - 46 * S, 95 * S, "#a9c8be", 0.12, 280, 2.2);
    hills(groundY - 8 * S, 74 * S, "#8fb587", 0.2, 210, 1.2);
    tile(240 * S, 0.42, (x, i) => house(x, i, groundY + 2 * S));
    tile(320 * S, 0.5, (x, i) => tree(x + 130 * S, i, groundY + 4 * S));
    ground(groundY);
    tile(350 * S, 0.92, (x, i) => { if (i % 3 === 0) lamppost(x, groundY + 6 * S); else bush(x + 40 * S, groundY + 12 * S, 0.9 + rnd(i) * 0.5); });
    character(W * 0.42, groundY + 6 * S, worldX * 0.1);
    drawMotes(t);

    // warm color grade + vignette
    ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = "rgba(255,196,120,0.22)"; ctx.fillRect(0, 0, W, H); ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.5, H * 0.9);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(50,34,18,0.18)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    grain();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
