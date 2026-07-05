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

// ---- ASCII running stickman ----
(function () {
  const el = document.getElementById("runner");
  if (!el) return;

  // 5-row sprites. Arms + legs alternate to read as a running cycle.
  const SPRITES = [
    ["  O  ", " /|\\ ", "  |  ", " / \\ "],
    ["  O  ", " \\|_ ", "  |  ", " /|  "],
    [" _O  ", "  |\\ ", "  |  ", "  |\\ "],
    ["  O  ", " \\|\\ ", "  |  ", "  |\\ "],
    ["  O_ ", " /|  ", "  |  ", "  /| "],
    ["  O  ", " /|\\ ", "  |  ", " / \\ "],
    ["  O  ", " _|/ ", "  |  ", "  |\\ "],
    ["  O  ", " /|\\ ", "  |  ", " /|  "],
  ];

  const WIDTH = 42;       // canvas columns
  const SPRITE_X = 17;    // horizontal placement of the figure
  const groundChars = "_.._..__.._...__.._.._..__._.._...__..";
  let frame = 0;
  let groundOffset = 0;
  let bob = 0;

  function line(len, ch) { return new Array(len + 1).join(ch); }

  function render() {
    const sprite = SPRITES[frame % SPRITES.length];
    const rows = [];

    // small vertical bounce
    bob = frame % 2 === 0 ? 0 : 1;
    if (bob === 1) rows.push(line(WIDTH, " "));

    for (const s of sprite) {
      const left = line(SPRITE_X, " ");
      const right = line(WIDTH - SPRITE_X - s.length, " ");
      rows.push((left + s + right).slice(0, WIDTH));
    }

    if (bob === 0) rows.push(line(WIDTH, " "));

    // scrolling ground
    let ground = "";
    for (let i = 0; i < WIDTH; i++) {
      ground += groundChars[(i + groundOffset) % groundChars.length];
    }
    rows.push(ground);

    // speed streaks trailing the runner
    let streaks = line(WIDTH, " ").split("");
    if (frame % 2 === 0) {
      streaks[SPRITE_X - 3] = "-";
      streaks[SPRITE_X - 6] = "-";
    } else {
      streaks[SPRITE_X - 4] = "-";
      streaks[SPRITE_X - 8] = "-";
    }
    rows.splice(bob === 1 ? 3 : 2, 0, streaks.join(""));

    el.textContent = rows.join("\n");

    frame++;
    groundOffset = (groundOffset + 2) % groundChars.length;
  }

  render();
  setInterval(render, 120);
})();
