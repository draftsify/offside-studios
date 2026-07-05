// Generates ASCII "halftone" run-cycle frames (chars: space, ○, ◐)
// by rasterizing a side-view running figure and mapping coverage -> chars.

const COLS = 62, ROWS = 34;   // character grid
const SSX = 3, SSY = 5;       // pixels per cell (cell aspect ~1.6 => square-ish figure)
const W = COLS * SSX, H = ROWS * SSY;
const FRAMES = 8;

const d2r = (d) => (d * Math.PI) / 180;

function newBuf() { return new Uint8Array(W * H); }
function setPx(buf, x, y) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = 1;
}
function disc(buf, cx, cy, r) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(buf, x, y);
    }
  }
}
// thick round-capped segment
function limb(buf, a, b, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(len);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(buf, a[0] + dx * t, a[1] + dy * t, r);
  }
}
// down vector: angle 0 = straight down, + = forward (right)
const down = (o, ang, len) => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len];
// up vector: angle 0 = straight up, + = forward (right)
const up = (o, ang, len) => [o[0] + Math.sin(ang) * len, o[1] - Math.cos(ang) * len];

function rasterFrame(phase) {
  const buf = newBuf();
  const t = phase;

  // --- proportions (in pixels) ---
  const hx = W * 0.44;
  const bob = Math.abs(Math.sin(t)) * 4;
  const hy = H * 0.50 - bob;
  const hip = [hx, hy];

  const lean = d2r(42);              // strong forward sprint lean
  const torsoLen = 42;
  const shoulder = up(hip, lean, torsoLen);
  const neck = up(shoulder, lean, 7);
  const headC = up(neck, lean, 13);

  // --- legs ---
  const thighLen = 36, calfLen = 34, footLen = 15;
  const AMP = d2r(52);              // stride amplitude
  // near leg (right)
  const thighR = AMP * Math.sin(t);
  const bendR = d2r(50 + 55 * (0.5 - 0.5 * Math.cos(t + 0.6))); // knee tuck 50..105
  const kneeR = down(hip, thighR, thighLen);
  const calfR = thighR - bendR;
  const ankleR = down(kneeR, calfR, calfLen);
  const footR = down(ankleR, calfR + d2r(80), footLen);
  // far leg (left)
  const thighL = AMP * Math.sin(t + Math.PI);
  const bendL = d2r(50 + 55 * (0.5 - 0.5 * Math.cos(t + Math.PI + 0.6)));
  const kneeL = down(hip, thighL, thighLen);
  const calfL = thighL - bendL;
  const ankleL = down(kneeL, calfL, calfLen);
  const footL = down(ankleL, calfL + d2r(80), footLen);

  // --- arms (bent, pumping; swing opposite to same-side leg) ---
  const upArm = 22, foreArm = 20;
  const armR = d2r(40) * Math.sin(t + Math.PI) - d2r(8);
  const elbowR = down(shoulder, armR, upArm);
  const foreR = armR + d2r(95);     // sharply bent elbow
  const handR = down(elbowR, foreR, foreArm);
  const armL = d2r(40) * Math.sin(t) - d2r(8);
  const elbowL = down(shoulder, armL, upArm);
  const foreL = armL + d2r(95);
  const handL = down(elbowL, foreL, foreArm);

  // draw far side first (thinner), then near side, then torso/head
  limb(buf, shoulder, elbowL, 5); limb(buf, elbowL, handL, 4);
  limb(buf, hip, kneeL, 8); limb(buf, kneeL, ankleL, 6); limb(buf, ankleL, footL, 5);

  limb(buf, hip, shoulder, 11);            // torso
  disc(buf, headC[0], headC[1], 11);       // head

  limb(buf, hip, kneeR, 9); limb(buf, kneeR, ankleR, 7); limb(buf, ankleR, footR, 5);
  limb(buf, shoulder, elbowR, 6); limb(buf, elbowR, handR, 5);

  return buf;
}

function toAscii(buf) {
  let out = "";
  for (let cy = 0; cy < ROWS; cy++) {
    let row = "";
    for (let cx = 0; cx < COLS; cx++) {
      let on = 0;
      for (let y = 0; y < SSY; y++)
        for (let x = 0; x < SSX; x++)
          on += buf[(cy * SSY + y) * W + (cx * SSX + x)];
      const frac = on / (SSX * SSY);
      row += frac === 0 ? " " : frac < 0.5 ? "○" : "◐";
    }
    out += row.replace(/\s+$/, "");
    if (cy < ROWS - 1) out += "\n";
  }
  return out;
}

const frames = [];
for (let k = 0; k < FRAMES; k++) {
  frames.push(toAscii(rasterFrame((k / FRAMES) * Math.PI * 2)));
}

if (process.argv[2] === "--preview") {
  frames.forEach((f, i) => {
    console.log(`\n===== frame ${i} =====`);
    console.log(f);
  });
} else {
  require("fs").writeFileSync(
    require("path").join(__dirname, "..", "runner-frames.json"),
    JSON.stringify(frames)
  );
  console.log("wrote runner-frames.json with", frames.length, "frames");
}
