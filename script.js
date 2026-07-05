// ---- 3D alley scene (runner + ASCII buildings), orbit camera, rendered to ASCII ----
(function () {
  const stage = document.getElementById("stage");
  const out = document.getElementById("runner");
  if (!stage || !out) return;

  // ASCII grid
  const COLS = 150, ROWS = 84;
  const SSX = 3, SSY = 5;
  const PW = COLS * SSX, PH = ROWS * SSY;
  const SCALE = PH * 0.135;
  const cx = PW / 2, cy = PH * 0.52;
  const FOCAL = 7;

  const cv = document.createElement("canvas");
  cv.width = PW; cv.height = PH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  // density ramp + fine dither texture
  const RAMP = [[14, " "], [42, "·"], [80, "○"], [140, "◐"], [999, "●"]];
  function ch(v) { for (let i = 0; i < RAMP.length; i++) if (v < RAMP[i][0]) return RAMP[i][1]; return "●"; }
  const BAYER = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const DITHER = 34;

  // world light (fixed sun -> shading stays consistent while orbiting)
  const L = (() => { const v = [-0.35, 0.82, 0.45]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
  const GROUND_Y = -1.04;

  // ---- orbit camera (eased, slow) ----
  let rotY = 0.6, rotX = -0.3, tgtY = 0.6, tgtX = -0.3, velY = 0;
  const SENS = 0.006, EASE = 0.075, IDLE = 0.0012, DECAY = 0.95, REST_X = -0.28;
  let dragging = false, lastX = 0, lastY = 0;
  stage.addEventListener("pointerdown", (e) => {
    dragging = true; stage.classList.add("dragging");
    lastX = e.clientX; lastY = e.clientY; velY = 0;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    tgtY += dx * SENS;
    tgtX = Math.max(-0.75, Math.min(0.2, tgtX + dy * SENS * 0.7));
    velY = dx * SENS;
  });
  function endDrag() { dragging = false; stage.classList.remove("dragging"); }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  function project(p) {
    const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(rotX), sX = Math.sin(rotX);
    const x = p[0], y = p[1], z = p[2];
    const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
    const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2);
    return { x: cx + x1 * SCALE * persp, y: cy - y2 * SCALE * persp, z: z2, persp };
  }

  // ---- static scene: alley buildings + ground ----
  function makeBox(cx0, cz0, w, d, h) {
    const x0 = cx0 - w / 2, x1 = cx0 + w / 2, z0 = cz0 - d / 2, z1 = cz0 + d / 2;
    const y0 = GROUND_Y, y1 = GROUND_Y + h;
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    const faces = [
      { idx: [4, 5, 6, 7], n: [0, 1, 0] },
      { idx: [1, 2, 6, 5], n: [1, 0, 0] },
      { idx: [3, 0, 4, 7], n: [-1, 0, 0] },
      { idx: [2, 3, 7, 6], n: [0, 0, 1] },
      { idx: [0, 1, 5, 4], n: [0, 0, -1] },
    ];
    const edges = [
      [0, 4], [1, 5], [2, 6], [3, 7],   // verticals
      [4, 5], [5, 6], [6, 7], [7, 4],   // top
      [0, 1], [1, 2], [2, 3], [3, 0],   // base
    ];
    return { v, faces, edges };
  }
  const BOXES = [
    makeBox(-1.85, -1.5, 0.9, 0.85, 1.7), makeBox(-0.35, -1.55, 0.95, 0.9, 2.2), makeBox(1.2, -1.5, 0.9, 0.85, 1.4),
    makeBox(-1.7, 1.5, 0.9, 0.85, 1.9), makeBox(-0.1, 1.55, 0.95, 0.9, 1.5), makeBox(1.45, 1.5, 0.9, 0.85, 2.3),
  ];
  const GRID = (() => {
    const g = [], A = 2.1, S = 0.7;
    for (let x = -A; x <= A + 1e-3; x += S) g.push([[x, GROUND_Y, -A], [x, GROUND_Y, A]]);
    for (let z = -A; z <= A + 1e-3; z += S) g.push([[-A, GROUND_Y, z], [A, GROUND_Y, z]]);
    return g;
  })();

  // ---- runner skeleton ----
  const T = { thigh: 0.46, calf: 0.44, foot: 0.17, uarm: 0.34, farm: 0.32, hipZ: 0.13, shZ: 0.15 };
  const seg = (b, a, l) => [b[0] + Math.sin(a) * l, b[1] - Math.cos(a) * l, b[2]];
  function twistY(pt, a, ax, az) {
    const dx = pt[0] - ax, dz = pt[2] - az, c = Math.cos(a), s = Math.sin(a);
    return [ax + dx * c + dz * s, pt[1], az - dx * s + dz * c];
  }
  function gb(x, c, w) { let d = x - c; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.exp(-(d * d) / (2 * w * w)); }

  function pose(p) {
    const bob = 0.05 * Math.cos(2 * p);
    const leanX = 0.06 + 0.025 * Math.sin(2 * p);
    const twist = 0.22 * Math.sin(p);
    const sway = 0.03 * Math.sin(p);

    const pelvis = [0, bob, 0];
    const spineMid = [leanX * 0.45, 0.32 + bob, 0];
    const chest = [leanX, 0.62 + bob, 0];
    const neckB = [leanX, 0.72 + bob, 0];               // yoke root
    const neck = [leanX * 1.12, 0.78 + bob, 0];
    const head = [leanX * 1.25 + 0.03, 0.96 + bob, 0.02 * Math.sin(p)];

    // shoulders sit slightly BELOW & out from the yoke -> natural sloped shoulders
    const shR = twistY([leanX, 0.685 + bob, T.shZ], twist, leanX, 0);
    const shL = twistY([leanX, 0.685 + bob, -T.shZ], twist, leanX, 0);
    const hipR = twistY([0, 0.02 + bob, T.hipZ + sway], -twist, 0, 0);
    const hipL = twistY([0, 0.02 + bob, -T.hipZ + sway], -twist, 0, 0);

    function leg(hip, ph) {
      const th = 0.62 * Math.sin(ph) + 0.34 * Math.sin(ph + 0.5);
      const flex = 0.16 + 1.35 * gb(ph, 4.95, 0.95) + 0.34 * gb(ph, 2.5, 1.2);
      const knee = seg(hip, th, T.thigh);
      const cAng = th - flex;
      const ankle = seg(knee, cAng, T.calf);
      const footAng = cAng + 1.35 + 0.45 * gb(ph, 3.7, 0.8) - 0.3 * gb(ph, 1.3, 0.9);
      const foot = seg(ankle, footAng, T.foot);
      return { knee, ankle, foot };
    }
    function arm(sh, ph) {
      const a = 0.4 * Math.sin(ph) - 0.06;                 // upper arm hangs, modest swing
      const fwd = Math.max(0, Math.sin(ph));
      const bend = 1.28 + 0.6 * fwd;                       // elbow tightens as hand drives up-front
      const elbow = seg(sh, a, T.uarm);
      const wrist = seg(elbow, a + bend + 0.12 * Math.sin(ph - 0.6), T.farm);
      return { elbow, wrist };
    }
    const lR = leg(hipR, p), lL = leg(hipL, p + Math.PI);
    const aR = arm(shR, p + Math.PI), aL = arm(shL, p);

    const bones = [
      [pelvis, spineMid, 1.15, 0.05], [spineMid, chest, 1.05, -0.06], [chest, neck, 0.8, 0.04],
      [hipL, hipR, 0.85, 0.12],
      [neckB, shL, 0.6, 0.16], [neckB, shR, 0.6, -0.16],   // sloped, rounded shoulders (no flat bar / no M)
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
  // drop a point to the ground plane along the light direction -> real cast shadow
  function shadowPt(p) {
    const t = p[1] - GROUND_Y;
    return [p[0] + t * (-L[0] / L[1]), GROUND_Y + 0.01, p[2] + t * (-L[2] / L[1])];
  }

  function rasterize(fig) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, PW, PH);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const items = [];

    // ground grid (clean perspective floor)
    for (const [a, b] of GRID) {
      const pa = project(a), pb = project(b);
      items.push({ z: (pa.z + pb.z) / 2 - 0.35, kind: "line", pa, pb, w: 1, tone: 58, curve: 0 });
    }
    // buildings: wireframe boxes (bright edges) -> clean 3D structures
    for (const box of BOXES) {
      const pv = box.v.map(project);
      for (const [a, b] of box.edges) {
        const pa = pv[a], pb = pv[b];
        items.push({ z: (pa.z + pb.z) / 2, kind: "line", pa, pb, w: 1.5, tone: 160, curve: 0 });
      }
    }

    // runner cast shadow (real geometry on the floor)
    for (let pass = 0; pass < 2; pass++) {
      const soft = pass === 0 ? 2.2 : 0.8, tone = pass === 0 ? 22 : 34;
      for (const [a, b, w, curve] of fig.bones) {
        const pa = project(shadowPt(a)), pb = project(shadowPt(b));
        items.push({ z: (pa.z + pb.z) / 2 + 0.005, kind: "line", pa, pb, w: w * LW * SCALE + soft, tone, curve });
      }
    }

    // runner (bright, depth + light shaded)
    const B = fig.bones.map(([a, b, w, curve]) => {
      const pa = project(a), pb = project(b);
      return { pa, pb, w, curve: curve || 0, z: (pa.z + pb.z) / 2, pw: (pa.persp + pb.persp) / 2 };
    });
    for (const it of B) {
      const py = (it.pa.y + it.pb.y) / 2, px = (it.pa.x + it.pb.x) / 2;
      const light = (cy - py) / PH * 40 + (cx - px) / PW * 16;
      const g = Math.max(150, Math.min(255, Math.round(178 + it.z * 190 + light)));
      items.push({ z: it.z + 0.5, kind: "line", pa: it.pa, pb: it.pb, w: Math.max(1.4, it.w * LW * 1.7 * SCALE * it.pw), tone: g, curve: it.curve });
    }
    const ph = project(fig.head);
    items.push({ z: ph.z + 0.55, kind: "head", p: ph, r: fig.headR * 1.15 * SCALE * ph.persp, tone: 235 });

    // painter's sort: far -> near
    items.sort((m, n) => m.z - n.z);
    for (const it of items) {
      if (it.kind === "poly") {
        ctx.fillStyle = "rgb(" + it.tone + "," + it.tone + "," + it.tone + ")";
        ctx.beginPath();
        ctx.moveTo(it.pts[0].x, it.pts[0].y);
        for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].x, it.pts[i].y);
        ctx.closePath(); ctx.fill();
      } else if (it.kind === "line") {
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
    const p = (now - start) * 0.0013;
    if (!dragging) { tgtY += velY; velY *= DECAY; tgtY += IDLE; tgtX += (REST_X - tgtX) * 0.02; }
    rotY += (tgtY - rotY) * EASE;
    rotX += (tgtX - rotX) * EASE;
    acc += now - last; last = now;
    if (acc >= 34) { acc = 0; rasterize(pose(p)); toAscii(); }
    requestAnimationFrame(frame);
  }
  rasterize(pose(0)); toAscii();
  requestAnimationFrame(frame);
})();
