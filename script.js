// ---- 3D running figure, rendered to ASCII (cinematic slow-motion) ----
(function () {
  const stage = document.getElementById("stage");
  const out = document.getElementById("runner");
  if (!stage || !out) return;

  // ASCII grid
  const COLS = 104, ROWS = 52;
  const SSX = 3, SSY = 5;                 // offscreen px per cell (aspect ~1.67)
  const PW = COLS * SSX, PH = ROWS * SSY; // offscreen resolution
  const SCALE = PH * 0.36;
  const cx = PW / 2, cy = PH / 2 + SCALE * 0.06;
  const FOCAL = 4.2;

  const cv = document.createElement("canvas");
  cv.width = PW; cv.height = PH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  // density ramp (dark -> dense)
  const RAMP = [
    [14, " "], [46, "·"], [98, "○"], [165, "◐"], [999, "●"],
  ];
  function ch(v) {
    for (let i = 0; i < RAMP.length; i++) if (v < RAMP[i][0]) return RAMP[i][1];
    return "●";
  }

  // ---- rotation state (slow auto-orbit + drag) ----
  let rotY = 0.5, rotX = -0.14;
  let velY = 0;
  const REST_X = -0.14, IDLE = 0.0016;    // gentle cinematic spin
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
    rotY += dx * 0.01;
    rotX = Math.max(-0.95, Math.min(0.95, rotX + dy * 0.006));
    velY = dx * 0.01;
  });
  function endDrag() { dragging = false; stage.classList.remove("dragging"); }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // ---- skeleton (local, +Y up, faces +X, lateral = Z) ----
  const T = { thigh: 0.46, calf: 0.44, foot: 0.17, uarm: 0.34, farm: 0.32, hipZ: 0.13, shZ: 0.18 };
  // "down" vector rotated about lateral(Z) axis: +a swings forward(+X)
  const seg = (b, a, l) => [b[0] + Math.sin(a) * l, b[1] - Math.cos(a) * l, b[2]];
  // rotate a point about a vertical (Y) axis passing through (ax,·,az)
  function twistY(pt, a, ax, az) {
    const dx = pt[0] - ax, dz = pt[2] - az, c = Math.cos(a), s = Math.sin(a);
    return [ax + dx * c + dz * s, pt[1], az - dx * s + dz * c];
  }

  function pose(p) {
    const bob = 0.05 * Math.cos(2 * p);
    const leanX = 0.06 + 0.025 * Math.sin(2 * p);   // torso lean breathes
    const twist = 0.22 * Math.sin(p);               // shoulders/hips counter-rotate
    const sway = 0.03 * Math.sin(p);                // gentle hip sway

    const pelvis = [0, bob, 0];
    const spineMid = [leanX * 0.45, 0.32 + bob, 0];
    const chest = [leanX, 0.62 + bob, 0];
    const neck = [leanX * 1.12, 0.77 + bob + 0.01 * Math.cos(2 * p), 0];
    // head follows the motion (slight nod + lead)
    const head = [leanX * 1.25 + 0.03, 0.95 + bob, 0.02 * Math.sin(p)];

    // shoulders twist one way, hips the other -> natural torso rotation
    const shR = twistY([leanX, 0.72 + bob, T.shZ], twist, leanX, 0);
    const shL = twistY([leanX, 0.72 + bob, -T.shZ], twist, leanX, 0);
    const hipR = twistY([0, 0.02 + bob, T.hipZ + sway], -twist, 0, 0);
    const hipL = twistY([0, 0.02 + bob, -T.hipZ + sway], -twist, 0, 0);

    const LA = 0.92, AA = 0.8;
    function leg(hip, ph) {
      const th = LA * Math.sin(ph);
      // knee flex with a little lag (secondary motion)
      const flex = 0.4 + 0.95 * (0.5 - 0.5 * Math.cos(ph + 0.75));
      const knee = seg(hip, th, T.thigh);
      const ankle = seg(knee, th - flex, T.calf);
      const foot = seg(ankle, th - flex + 1.5 + 0.2 * Math.sin(ph), T.foot);
      return { knee, ankle, foot };
    }
    function arm(sh, ph) {
      const a = AA * Math.sin(ph) - 0.12;
      // elbow drives harder on the forward swing -> relaxed, human
      const bend = 1.2 + 0.5 * (0.5 - 0.5 * Math.cos(ph));
      const elbow = seg(sh, a, T.uarm);
      const wrist = seg(elbow, a + bend, T.farm);
      return { elbow, wrist };
    }
    const lR = leg(hipR, p), lL = leg(hipL, p + Math.PI);
    const aR = arm(shR, p + Math.PI), aL = arm(shL, p);

    // bones: [a, b, width, curve]  (curve = organic bow, screen-space)
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

  function project(pt, ry, rx) {
    const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
    const x = pt[0], y = pt[1], z = pt[2];
    const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
    const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2);
    return { x: cx + x1 * SCALE * persp, y: cy - y2 * SCALE * persp, z: z2, persp };
  }

  const LW = 0.055; // stroke thickness in the offscreen buffer

  function rasterize(fig) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, PW, PH);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const items = [];
    for (const [a, b, w, curve] of fig.bones) {
      const pa = project(a, rotY, rotX), pb = project(b, rotY, rotX);
      items.push({ t: "b", pa, pb, w, curve: curve || 0, z: (pa.z + pb.z) / 2, pw: (pa.persp + pb.persp) / 2 });
    }
    const ph = project(fig.head, rotY, rotX);
    items.push({ t: "h", p: ph, z: ph.z + 0.05, r: fig.headR });
    items.sort((m, n) => m.z - n.z);

    for (const it of items) {
      // brightness by depth: nearer -> brighter (encodes 3D into the ASCII density)
      const g = Math.max(90, Math.min(255, Math.round(158 + it.z * 240)));
      const col = "rgb(" + g + "," + g + "," + g + ")";
      if (it.t === "b") {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.2, it.w * LW * SCALE * it.pw);
        ctx.beginPath();
        ctx.moveTo(it.pa.x, it.pa.y);
        const dx = it.pb.x - it.pa.x, dy = it.pb.y - it.pa.y;
        const len = Math.hypot(dx, dy) || 1;
        if (it.curve) {
          // organic bow: control point offset perpendicular to the bone
          const mx = (it.pa.x + it.pb.x) / 2, my = (it.pa.y + it.pb.y) / 2;
          const nx = -dy / len, ny = dx / len;
          ctx.quadraticCurveTo(mx + nx * it.curve * len, my + ny * it.curve * len, it.pb.x, it.pb.y);
        } else {
          ctx.lineTo(it.pb.x, it.pb.y);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(it.p.x, it.p.y, it.r * SCALE * it.p.persp, 0, Math.PI * 2);
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
        row += ch(sum / (SSX * SSY));
      }
      s += row;
      if (cyi < ROWS - 1) s += "\n";
    }
    out.textContent = s;
  }

  const start = performance.now();
  let acc = 0, last = start;
  function frame(now) {
    // slow-motion cinematic run
    const p = (now - start) * 0.0013;

    if (!dragging) {
      rotY += velY; velY *= 0.95;
      rotY += IDLE;
      rotX += (REST_X - rotX) * 0.03;
    }

    // render ASCII at ~28fps for a filmic cadence
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
