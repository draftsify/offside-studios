// ---- Runner in a 3D ASCII city (orbit camera, buildings all around, fullscreen) ----
(function () {
  const stage = document.getElementById("stage");
  const out = document.getElementById("runner");
  if (!stage || !out) return;

  // ASCII grid
  const COLS = 152, ROWS = 86;
  const SSX = 3, SSY = 5;
  const PW = COLS * SSX, PH = ROWS * SSY;
  const SCALE = PH * 0.27;              // runner keeps its previous, prominent size
  const cx = PW / 2, cy = PH * 0.48;
  const CAMD = 4.6, FL = 4.6, NEAR = 0.4;  // perspective camera, orbits at distance CAMD

  const cv = document.createElement("canvas");
  cv.width = PW; cv.height = PH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  const RAMP = [[14, " "], [42, "·"], [80, "○"], [140, "◐"], [999, "●"]];
  function ch(v) { for (let i = 0; i < RAMP.length; i++) if (v < RAMP[i][0]) return RAMP[i][1]; return "●"; }
  const BAYER = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const DITHER = 34;
  const GROUND_Y = -1.04;

  // ---- orbit camera (eased, slow) ----
  // fixed camera — no rotation
  const rotY = 0.6, rotX = -0.2;

  function project(p) {
    const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(rotX), sX = Math.sin(rotX);
    const x = p[0], y = p[1], z = p[2];
    const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
    const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
    const zc = CAMD - z2;                 // depth from camera
    const persp = FL / zc;
    return { x: cx + x1 * persp * SCALE, y: cy - y2 * persp * SCALE, zc, ok: zc > NEAR };
  }

  // ---- static city: a ring of buildings all around, far from the runner ----
  function makeBox(cx0, cz0, w, d, h) {
    const x0 = cx0 - w / 2, x1 = cx0 + w / 2, z0 = cz0 - d / 2, z1 = cz0 + d / 2;
    const y0 = GROUND_Y, y1 = GROUND_Y + h;
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    const edges = [
      [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4], [0, 1], [1, 2], [2, 3], [3, 0],
    ];
    return { v, edges };
  }
  const BOXES = [];
  const RINGS = [
    { R: 6.0, n: 11, hmin: 2.2, hmax: 4.2, w: 1.2 },
    { R: 9.2, n: 15, hmin: 3.4, hmax: 6.8, w: 1.7 },
  ];
  for (const r of RINGS) {
    for (let i = 0; i < r.n; i++) {
      const ang = (i / r.n) * Math.PI * 2 + r.R;
      const jit = 0.5 * Math.sin(i * 2.7);
      const R = r.R + jit;
      const h = r.hmin + ((i * 37) % 100) / 100 * (r.hmax - r.hmin);
      BOXES.push(makeBox(R * Math.cos(ang), R * Math.sin(ang), r.w, r.w, h));
    }
  }
  // ground grid reaching out to the city
  const GRID = (() => {
    const g = [], A = 10, S = 1.15;
    for (let x = -A; x <= A + 1e-3; x += S) g.push([[x, GROUND_Y, -A], [x, GROUND_Y, A]]);
    for (let z = -A; z <= A + 1e-3; z += S) g.push([[-A, GROUND_Y, z], [A, GROUND_Y, z]]);
    return g;
  })();

  // ---- runner ----
  const T = { thigh: 0.46, calf: 0.44, foot: 0.17, uarm: 0.34, farm: 0.32, hipZ: 0.13, shZ: 0.15 };
  const seg = (b, a, l) => [b[0] + Math.sin(a) * l, b[1] - Math.cos(a) * l, b[2]];
  function twistY(pt, a, ax, az) {
    const dx = pt[0] - ax, dz = pt[2] - az, c = Math.cos(a), s = Math.sin(a);
    return [ax + dx * c + dz * s, pt[1], az - dx * s + dz * c];
  }
  function gb(x, c, w) { let d = x - c; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.exp(-(d * d) / (2 * w * w)); }

  function pose(p) {
    const bob = 0.028 * Math.cos(2 * p);
    const leanX = 0.02 + 0.012 * Math.sin(2 * p);   // upright walking posture
    const twist = 0.12 * Math.sin(p);
    const sway = 0.025 * Math.sin(p);
    const pelvis = [0, bob, 0];
    const spineMid = [leanX * 0.45, 0.32 + bob, 0];
    const chest = [leanX, 0.62 + bob, 0];
    const neckB = [leanX, 0.72 + bob, 0];
    const neck = [leanX * 1.12, 0.78 + bob, 0];
    const head = [leanX * 1.25 + 0.03, 0.96 + bob, 0.02 * Math.sin(p)];
    const shR = twistY([leanX, 0.685 + bob, T.shZ], twist, leanX, 0);
    const shL = twistY([leanX, 0.685 + bob, -T.shZ], twist, leanX, 0);
    const hipR = twistY([0, 0.02 + bob, T.hipZ + sway], -twist, 0, 0);
    const hipL = twistY([0, 0.02 + bob, -T.hipZ + sway], -twist, 0, 0);
    function leg(hip, ph) {
      // shorter stride, gentle knee flex, foot stays low (walking)
      const th = 0.42 * Math.sin(ph) + 0.12 * Math.sin(ph + 0.4);
      const flex = 0.12 + 0.55 * gb(ph, 4.7, 1.1) + 0.28 * gb(ph, 1.9, 1.1);
      const knee = seg(hip, th, T.thigh);
      const cAng = th - flex;
      const ankle = seg(knee, cAng, T.calf);
      const footAng = cAng + 1.4 + 0.28 * gb(ph, 3.6, 0.9) - 0.18 * gb(ph, 1.1, 0.9);
      return { knee, ankle, foot: seg(ankle, footAng, T.foot) };
    }
    function arm(sh, ph) {
      // gentle, nearly-straight arm swing (walking)
      const a = 0.26 * Math.sin(ph) - 0.02;
      const bend = 0.42 + 0.2 * Math.max(0, Math.sin(ph));
      const elbow = seg(sh, a, T.uarm);
      return { elbow, wrist: seg(elbow, a + bend + 0.06 * Math.sin(ph - 0.5), T.farm) };
    }
    const lR = leg(hipR, p), lL = leg(hipL, p + Math.PI);
    const aR = arm(shR, p + Math.PI), aL = arm(shL, p);
    const bones = [
      [pelvis, spineMid, 1.15, 0.05], [spineMid, chest, 1.05, -0.06], [chest, neck, 0.8, 0.04],
      [hipL, hipR, 0.85, 0.12],
      [neckB, shL, 0.6, 0.16], [neckB, shR, 0.6, -0.16],
      [shL, aL.elbow, 0.72, 0.1], [aL.elbow, aL.wrist, 0.56, 0.14],
      [shR, aR.elbow, 0.72, -0.1], [aR.elbow, aR.wrist, 0.56, -0.14],
      [hipL, lL.knee, 1.0, 0.09], [lL.knee, lL.ankle, 0.84, -0.1], [lL.ankle, lL.foot, 0.64, 0.06],
      [hipR, lR.knee, 1.0, -0.09], [lR.knee, lR.ankle, 0.84, 0.1], [lR.ankle, lR.foot, 0.64, -0.06],
    ];
    return { bones, head, headR: 0.15 };
  }

  const LW = 0.05;
  function curveTo(pa, pb, curve) {
    ctx.moveTo(pa.x, pa.y);
    if (curve) {
      const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, nx = -dy / len, ny = dx / len;
      ctx.quadraticCurveTo(mx + nx * curve * len, my + ny * curve * len, pb.x, pb.y);
    } else ctx.lineTo(pb.x, pb.y);
  }
  function shadowPt(p) {
    const t = p[1] - GROUND_Y;
    return [p[0] + t * 0.42, GROUND_Y + 0.01, p[2] - 0.5 * t];
  }

  function rasterize(fig) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, PW, PH);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const items = [];

    // floor grid (fades with distance)
    for (const [a, b] of GRID) {
      const pa = project(a), pb = project(b);
      if (!pa.ok || !pb.ok) continue;
      const zc = (pa.zc + pb.zc) / 2;
      const tone = Math.max(22, Math.round(78 - (zc - CAMD) * 6));
      items.push({ z: zc, kind: "line", pa, pb, w: 1, tone, curve: 0 });
    }
    // buildings: wireframe, far -> reads as a city all around
    for (const box of BOXES) {
      const pv = box.v.map(project);
      for (const [a, b] of box.edges) {
        const pa = pv[a], pb = pv[b];
        if (!pa.ok || !pb.ok) continue;
        const zc = (pa.zc + pb.zc) / 2;
        const tone = Math.max(70, Math.round(190 - (zc - CAMD) * 9));
        items.push({ z: zc, kind: "line", pa, pb, w: 1.4, tone, curve: 0 });
      }
    }
    // runner cast shadow on the floor
    for (let pass = 0; pass < 2; pass++) {
      const soft = pass === 0 ? 2.4 : 0.9, tone = pass === 0 ? 24 : 38;
      for (const [a, b, w, curve] of fig.bones) {
        const pa = project(shadowPt(a)), pb = project(shadowPt(b));
        if (!pa.ok || !pb.ok) continue;
        items.push({ z: (pa.zc + pb.zc) / 2 - 0.01, kind: "line", pa, pb, w: w * LW * SCALE + soft, tone, curve });
      }
    }
    // runner (bright, on top)
    for (const [a, b, w, curve] of fig.bones) {
      const pa = project(a), pb = project(b);
      const py = (pa.y + pb.y) / 2, px = (pa.x + pb.x) / 2;
      const light = (cy - py) / PH * 40 + (cx - px) / PW * 16;
      const g = Math.max(150, Math.min(255, Math.round(185 + light)));
      const pw = (FL / pa.zc + FL / pb.zc) / 2;
      items.push({ z: (pa.zc + pb.zc) / 2 - 0.02, kind: "line", pa, pb, w: Math.max(1.4, w * LW * SCALE * pw), tone: g, curve });
    }
    const ph = project(fig.head);
    items.push({ z: ph.zc - 0.03, kind: "head", p: ph, r: fig.headR * (FL / ph.zc) * SCALE, tone: 235 });

    // painter's sort: far (large zc) -> near
    items.sort((m, n) => n.z - m.z);
    for (const it of items) {
      if (it.kind === "line") {
        ctx.strokeStyle = "rgb(" + it.tone + "," + it.tone + "," + it.tone + ")";
        ctx.lineWidth = it.w;
        ctx.beginPath(); curveTo(it.pa, it.pb, it.curve); ctx.stroke();
      } else {
        const r = it.r, p = it.p;
        const grd = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.15, p.x, p.y, r);
        grd.addColorStop(0, "rgb(255,255,255)");
        grd.addColorStop(1, "rgb(" + it.tone + "," + it.tone + "," + it.tone + ")");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function toAscii() {
    const data = ctx.getImageData(0, 0, PW, PH).data;
    let s = "";
    for (let cyi = 0; cyi < ROWS; cyi++) {
      let row = "";
      for (let cxi = 0; cxi < COLS; cxi++) {
        let sum = 0;
        for (let y = 0; y < SSY; y++) {
          const base = ((cyi * SSY + y) * PW + cxi * SSX) * 4;
          for (let x = 0; x < SSX; x++) sum += data[base + x * 4];
        }
        const avg = sum / (SSX * SSY);
        if (avg < 16) { row += " "; continue; }
        const off = (BAYER[cyi & 7][cxi & 7] / 64 - 0.5) * DITHER;
        const grain = (((cxi * 13 + cyi * 29) % 11) - 5) * 2;
        row += ch(avg + off + grain);
      }
      s += row;
      if (cyi < ROWS - 1) s += "\n";
    }
    out.textContent = s;
  }

  const start = performance.now();
  let acc = 0, last = start;
  function frame(now) {
    const p = (now - start) * 0.0011;   // gentle walking cadence
    acc += now - last; last = now;
    if (acc >= 34) { acc = 0; rasterize(pose(p)); toAscii(); }
    requestAnimationFrame(frame);
  }
  rasterize(pose(0)); toAscii();
  requestAnimationFrame(frame);
})();
