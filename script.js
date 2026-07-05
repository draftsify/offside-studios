// ---- 3D running figure -> ASCII (cinematic slow-motion, human shadow, textured) ----
(function () {
  const stage = document.getElementById("stage");
  const out = document.getElementById("runner");
  if (!stage || !out) return;

  // ASCII grid (denser grid -> smaller dots)
  const COLS = 140, ROWS = 76;
  const SSX = 3, SSY = 5;
  const PW = COLS * SSX, PH = ROWS * SSY;
  const SCALE = PH * 0.35;
  const cx = PW / 2, cy = PH / 2 + SCALE * 0.02;
  const FOCAL = 4.2;

  const cv = document.createElement("canvas");
  cv.width = PW; cv.height = PH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  // density ramp (dark -> dense)
  const RAMP = [[14, " "], [42, "·"], [80, "○"], [140, "◐"], [999, "●"]];
  function ch(v) { for (let i = 0; i < RAMP.length; i++) if (v < RAMP[i][0]) return RAMP[i][1]; return "●"; }
  // 8x8 ordered-dither for fine halftone texture
  const BAYER = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const DITHER = 62;

  // ---- rotation: eased target -> fluid, slow drag ----
  let rotY = 0.5, rotX = -0.14;
  let tgtY = 0.5, tgtX = -0.14;
  let velY = 0;
  const SENS = 0.006, EASE = 0.075, IDLE = 0.0014, DECAY = 0.95, REST_X = -0.14;
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
    tgtX = Math.max(-0.9, Math.min(0.9, tgtX + dy * SENS * 0.7));
    velY = dx * SENS;
  });
  function endDrag() { dragging = false; stage.classList.remove("dragging"); }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // ---- skeleton ----
  const T = { thigh: 0.46, calf: 0.44, foot: 0.17, uarm: 0.34, farm: 0.32, hipZ: 0.13, shZ: 0.18 };
  const seg = (b, a, l) => [b[0] + Math.sin(a) * l, b[1] - Math.cos(a) * l, b[2]];
  function twistY(pt, a, ax, az) {
    const dx = pt[0] - ax, dz = pt[2] - az, c = Math.cos(a), s = Math.sin(a);
    return [ax + dx * c + dz * s, pt[1], az - dx * s + dz * c];
  }

  function pose(p) {
    const bob = 0.05 * Math.cos(2 * p);
    const leanX = 0.06 + 0.025 * Math.sin(2 * p);
    const twist = 0.22 * Math.sin(p);
    const sway = 0.03 * Math.sin(p);

    const pelvis = [0, bob, 0];
    const spineMid = [leanX * 0.45, 0.32 + bob, 0];
    const chest = [leanX, 0.62 + bob, 0];
    const neck = [leanX * 1.12, 0.77 + bob + 0.01 * Math.cos(2 * p), 0];
    const head = [leanX * 1.25 + 0.03, 0.95 + bob, 0.02 * Math.sin(p)];

    const shR = twistY([leanX, 0.72 + bob, T.shZ], twist, leanX, 0);
    const shL = twistY([leanX, 0.72 + bob, -T.shZ], twist, leanX, 0);
    const hipR = twistY([0, 0.02 + bob, T.hipZ + sway], -twist, 0, 0);
    const hipL = twistY([0, 0.02 + bob, -T.hipZ + sway], -twist, 0, 0);

    const LA = 0.92, AA = 0.8;
    function leg(hip, ph) {
      const th = LA * Math.sin(ph);
      const flex = 0.4 + 0.95 * (0.5 - 0.5 * Math.cos(ph + 0.75));
      const knee = seg(hip, th, T.thigh);
      const ankle = seg(knee, th - flex, T.calf);
      const foot = seg(ankle, th - flex + 1.5 + 0.2 * Math.sin(ph), T.foot);
      return { knee, ankle, foot };
    }
    function arm(sh, ph) {
      const a = AA * Math.sin(ph) - 0.12;
      const bend = 1.2 + 0.5 * (0.5 - 0.5 * Math.cos(ph));
      const elbow = seg(sh, a, T.uarm);
      const wrist = seg(elbow, a + bend, T.farm);
      return { elbow, wrist };
    }
    const lR = leg(hipR, p), lL = leg(hipL, p + Math.PI);
    const aR = arm(shR, p + Math.PI), aL = arm(shL, p);

    const bones = [
      [pelvis, spineMid, 1.15, 0.05], [spineMid, chest, 1.05, -0.06], [chest, neck, 0.82, 0.04],
      [hipL, hipR, 0.85, 0.12],
      [chest, shL, 0.68, 0.08], [chest, shR, 0.68, -0.08],
      [shL, aL.elbow, 0.72, 0.1], [aL.elbow, aL.wrist, 0.58, 0.14],
      [shR, aR.elbow, 0.72, -0.1], [aR.elbow, aR.wrist, 0.58, -0.14],
      [hipL, lL.knee, 1.0, 0.09], [lL.knee, lL.ankle, 0.84, -0.1], [lL.ankle, lL.foot, 0.64, 0.06],
      [hipR, lR.knee, 1.0, -0.09], [lR.knee, lR.ankle, 0.84, 0.1], [lR.ankle, lR.foot, 0.64, -0.06],
    ];
    return { bones, head, headR: 0.16 };
  }

  function project(pt) {
    const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(rotX), sX = Math.sin(rotX);
    const x = pt[0], y = pt[1], z = pt[2];
    const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
    const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2);
    return { x: cx + x1 * SCALE * persp, y: cy - y2 * SCALE * persp, z: z2, persp };
  }

  const LW = 0.055;

  function curveTo(pa, pb, curve) {
    ctx.moveTo(pa.x, pa.y);
    if (curve) {
      const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, nx = -dy / len, ny = dx / len;
      ctx.quadraticCurveTo(mx + nx * curve * len, my + ny * curve * len, pb.x, pb.y);
    } else ctx.lineTo(pb.x, pb.y);
  }

  function rasterize(fig) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, PW, PH);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // project everything once
    const B = [];
    for (const [a, b, w, curve] of fig.bones) {
      const pa = project(a), pb = project(b);
      B.push({ pa, pb, w, curve: curve || 0, z: (pa.z + pb.z) / 2, pw: (pa.persp + pb.persp) / 2 });
    }
    const ph = project(fig.head);
    let groundY = ph.y;
    for (const it of B) groundY = Math.max(groundY, it.pa.y, it.pb.y);
    groundY += 5;

    // ---- human-shaped cast shadow (figure sheared + flattened onto the floor) ----
    const LX = 0.42, SQ = 0.06;
    const sp = (p) => { const t = groundY - p.y; return { x: p.x + t * LX, y: groundY + t * SQ }; };
    ctx.globalAlpha = 1;
    for (let pass = 0; pass < 2; pass++) {
      const soft = pass === 0 ? 2.8 : 1.2;   // wide soft pass then tighter core
      const g = pass === 0 ? 32 : 56;
      ctx.strokeStyle = "rgb(" + g + "," + g + "," + g + ")";
      ctx.fillStyle = ctx.strokeStyle;
      for (const it of B) {
        ctx.lineWidth = Math.max(1.5, it.w * LW * SCALE * it.pw + soft);
        ctx.beginPath();
        curveTo(sp(it.pa), sp(it.pb), it.curve);
        ctx.stroke();
      }
      const sh = sp(ph);
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, fig.headR * SCALE * ph.persp + soft, fig.headR * SCALE * ph.persp * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- figure with light shading (overhead-left) ----
    const items = B.map((x) => ({ t: "b", ...x }));
    items.push({ t: "h", p: ph, z: ph.z + 0.05, r: fig.headR });
    items.sort((m, n) => m.z - n.z);

    for (const it of items) {
      const py = it.t === "b" ? (it.pa.y + it.pb.y) / 2 : it.p.y;
      const px = it.t === "b" ? (it.pa.x + it.pb.x) / 2 : it.p.x;
      const light = (cy - py) / PH * 46 + (cx - px) / PW * 20;   // top & left a touch brighter
      const g = Math.max(78, Math.min(255, Math.round(150 + it.z * 230 + light)));
      const col = "rgb(" + g + "," + g + "," + g + ")";
      if (it.t === "b") {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.2, it.w * LW * SCALE * it.pw);
        ctx.beginPath();
        curveTo(it.pa, it.pb, it.curve);
        ctx.stroke();
      } else {
        // head with a soft radial shade for a rounder, textured look
        const r = it.r * SCALE * it.p.persp;
        const grd = ctx.createRadialGradient(it.p.x - r * 0.3, it.p.y - r * 0.3, r * 0.15, it.p.x, it.p.y, r);
        grd.addColorStop(0, "rgb(255,255,255)");
        grd.addColorStop(1, col);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(it.p.x, it.p.y, r, 0, Math.PI * 2);
        ctx.fill();
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
        if (avg < 4) { row += " "; continue; }
        const off = (BAYER[cyi & 7][cxi & 7] / 64 - 0.5) * DITHER;   // fine halftone texture
        const grain = (((cxi * 13 + cyi * 29) % 11) - 5) * 3.2;      // stable stipple grain
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
    const p = (now - start) * 0.0013;  // slow-motion run

    if (!dragging) {
      tgtY += velY; velY *= DECAY;
      tgtY += IDLE;
      tgtX += (REST_X - tgtX) * 0.02;
    }
    // fluid easing toward the steering target
    rotY += (tgtY - rotY) * EASE;
    rotX += (tgtX - rotX) * EASE;

    acc += now - last; last = now;
    if (acc >= 34) {
      acc = 0;
      rasterize(pose(p));
      toAscii();
    }
    requestAnimationFrame(frame);
  }
  rasterize(pose(0));
  toAscii();
  requestAnimationFrame(frame);
})();
