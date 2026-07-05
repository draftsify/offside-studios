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

// ---- ASCII "halftone" running figure (side view) ----
(function () {
  const el = document.getElementById("runner");
  const frames = window.RUNNER_FRAMES;
  if (!el || !frames || !frames.length) return;

  let i = 0;
  el.textContent = frames[0];
  setInterval(() => {
    i = (i + 1) % frames.length;
    el.textContent = frames[i];
  }, 110);
})();
