// ---- Footer year ----
document.getElementById("year").textContent = new Date().getFullYear();

// ---- Duplicate marquee content for seamless loop ----
const marquee = document.getElementById("marquee");
if (marquee) marquee.innerHTML += marquee.innerHTML;

// ---- Contact form (mailto fallback, no backend) ----
const form = document.getElementById("contact-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const email = (data.get("email") || "").toString().trim();
    const message = (data.get("message") || "").toString().trim();
    if (!name || !email || !message) return;
    const subject = encodeURIComponent(`New project — ${name}`);
    const body = encodeURIComponent(`From: ${name} <${email}>\n\n${message}`);
    window.location.href = `mailto:hello@offside.studio?subject=${subject}&body=${body}`;
  });
}

// ---- 3D draggable running stickman ----
(function () {
  const wrap = document.getElementById("runner3d");
  const canvas = document.getElementById("runner-canvas");
  if (!wrap || !canvas) return;
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, SCALE = 150, cx = 0, cy = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const FOCAL = 4.2;

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    SCALE = Math.max(96, Math.min(H * 0.34, W * 0.42));
    cx = W / 2;
    cy = H / 2 + SCALE * 0.05;
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- rotation state ----
  let rotY = 0.55, rotX = -0.12;
  let velY = 0, prevRotY = rotY, prevRotX = rotX;
  const REST_X = -0.12, IDLE = 0.0016;
  let dragging = false, lastX = 0, lastY = 0;

  wrap.addEventListener("pointerdown", (e) => {
    dragging = true; wrap.classList.add("dragging");
    lastX = e.clientX; lastY = e.clientY; velY = 0;
    try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    rotY += dx * 0.011;
    rotX = Math.max(-0.95, Math.min(0.95, rotX + dy * 0.007));
    velY = dx * 0.011;
  });
  function endDrag() { dragging = false; wrap.classList.remove("dragging"); }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // ---- skeleton (local space, +Y up, faces +X, lateral = Z) ----
  const T = {
    thigh: 0.46, calf: 0.44, foot: 0.17,
    uarm: 0.34, farm: 0.32,
    hipZ: 0.13, shZ: 0.18,
  };
  // rotate a "down" vector about the lateral(Z) axis: +ang swings forward(+X)
  function seg(base, ang, len) {
    return [base[0] + Math.sin(ang) * len, base[1] - Math.cos(ang) * len, base[2]];
  }

  function pose(p) {
    const bob = 0.045 * Math.cos(2 * p);
    const lean = 0.07;                    // forward torso offset
    const pelvis = [0, bob, 0];
    const chest = [lean, 0.6 + bob, 0];
    const neck = [lean * 1.15, 0.76 + bob, 0];
    const head = [lean * 1.25, 0.95 + bob, 0];
    const shR = [lean, 0.72 + bob, T.shZ];
    const shL = [lean, 0.72 + bob, -T.shZ];
    const hipR = [0, 0.02 + bob, T.hipZ];
    const hipL = [0, 0.02 + bob, -T.hipZ];

    const LA = 0.9, AA = 0.72;
    function leg(hip, ph) {
      const th = LA * Math.sin(ph);
      const flex = 0.45 + 0.85 * (0.5 - 0.5 * Math.cos(ph + 0.6));
      const knee = seg(hip, th, T.thigh);
      const cAng = th - flex;
      const ankle = seg(knee, cAng, T.calf);
      const foot = seg(ankle, 1.35 + 0.25 * Math.sin(ph), T.foot);
      return { knee, ankle, foot };
    }
    function arm(sh, ph) {
      const a = AA * Math.sin(ph) - 0.1;
      const elbow = seg(sh, a, T.uarm);
      const wrist = seg(elbow, a + 1.45, T.farm);
      return { elbow, wrist };
    }
    const legR = leg(hipR, p);
    const legL = leg(hipL, p + Math.PI);
    const armR = arm(shR, p + Math.PI);
    const armL = arm(shL, p);

    // bones: [a, b, width]
    const bones = [
      [pelvis, chest, 1.15],
      [chest, neck, 0.85],
      [hipL, hipR, 0.9],
      [chest, shL, 0.7], [chest, shR, 0.7],
      [shL, armL.elbow, 0.72], [armL.elbow, armL.wrist, 0.6],
      [shR, armR.elbow, 0.72], [armR.elbow, armR.wrist, 0.6],
      [hipL, legL.knee, 0.98], [legL.knee, legL.ankle, 0.86], [legL.ankle, legL.foot, 0.66],
      [hipR, legR.knee, 0.98], [legR.knee, legR.ankle, 0.86], [legR.ankle, legR.foot, 0.66],
    ];
    return { bones, head, headR: 0.17, footY: Math.min(legR.foot[1], legL.foot[1]) };
  }

  function project(pt, ry, rx) {
    const cY = Math.cos(ry), sY = Math.sin(ry);
    const cX = Math.cos(rx), sX = Math.sin(rx);
    let x = pt[0], y = pt[1], z = pt[2];
    // rotateY
    let x1 = x * cY + z * sY;
    let z1 = -x * sY + z * cY;
    // rotateX
    let y2 = y * cX - z1 * sX;
    let z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2);
    return { x: cx + x1 * SCALE * persp, y: cy - y2 * SCALE * persp, z: z2, persp };
  }

  const LW = 0.078; // base stroke (bold stickman)

  function drawFigure(fig, ry, rx, alpha) {
    // build depth-sorted render items
    const items = [];
    for (const [a, b, w] of fig.bones) {
      const pa = project(a, ry, rx), pb = project(b, ry, rx);
      items.push({ t: "b", pa, pb, w, z: (pa.z + pb.z) / 2, pw: (pa.persp + pb.persp) / 2 });
    }
    const ph = project(fig.head, ry, rx);
    items.push({ t: "h", p: ph, z: ph.z + 0.05, r: fig.headR });
    items.sort((m, n) => m.z - n.z);

    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const it of items) {
      // depth shade: closer -> darker gray
      const g = Math.max(70, Math.min(178, Math.round(112 - it.z * 90)));
      const col = "rgb(" + g + "," + g + "," + g + ")";
      if (it.t === "b") {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, it.w * LW * SCALE * it.pw);
        ctx.beginPath();
        ctx.moveTo(it.pa.x, it.pa.y);
        ctx.lineTo(it.pb.x, it.pb.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(it.p.x, it.p.y, it.r * SCALE * it.p.persp, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function shadow(footY) {
    const gy = cy - footY * SCALE + 6;
    const rx = SCALE * 0.42, ry = SCALE * 0.07;
    const grd = ctx.createRadialGradient(cx, gy, 1, cx, gy, rx);
    grd.addColorStop(0, "rgba(0,0,0,0.10)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(cx, gy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const start = performance.now();
  function frame(now) {
    const p = ((now - start) * 0.0075);

    if (!dragging) {
      rotY += velY; velY *= 0.95;
      rotY += IDLE;
      rotX += (REST_X - rotX) * 0.04;
    }

    // per-frame rotation delta -> directional motion blur
    let dRy = rotY - prevRotY;
    let dRx = rotX - prevRotX;
    const EXAG = 1.7;
    const spread = Math.abs(dRy) * EXAG;
    const samples = 1 + Math.min(8, Math.floor(spread / 0.006));

    ctx.clearRect(0, 0, W, H);
    const fig = pose(p);
    shadow(fig.footY);

    const ryStart = rotY - dRy * EXAG;
    const rxStart = rotX - dRx * EXAG;
    for (let k = 0; k < samples; k++) {
      const t = samples === 1 ? 1 : k / (samples - 1);
      const ry = ryStart + (rotY - ryStart) * t;
      const rx = rxStart + (rotX - rxStart) * t;
      const a = samples === 1 ? 1 : 0.1 + 0.9 * Math.pow(t, 1.6);
      drawFigure(fig, ry, rx, a);
    }

    prevRotY = rotY; prevRotX = rotX;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
