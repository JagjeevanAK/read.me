/*
 * Starter simulation. Runs inside the exported page with two values in scope:
 *   root  the .lab-body element that holds sim.html
 *   Kit   helpers: Kit.loop, Kit.fitCanvas, Kit.colors, Kit.onTheme, Kit.font, Kit.ready, Kit.esc
 * Query elements through `root` so the simulation stays self-contained.
 */
const $ = (s) => root.querySelector(s);
const W = 860, H = 300;          // logical canvas size; Kit.fitCanvas scales it to the stage
const SERVICE = 0.25;            // seconds one worker spends on a message
const cv = $("#q-cv");

let C = {};
const readColors = () => { C = Kit.colors(["fg", "muted", "faint", "border", "card", "bg-2", "ok", "bad", "warn", "accent", "q-in", "q-worker", "q-grid"]); };
readColors();
Kit.onTheme(readColors);

/* ---------- state ---------- */
let S;
function reset() {
  S = {
    t: 0, paused: S ? S.paused : false, acc: 0,
    rate: +$("#q-rate").value, cap: +$("#q-cap").value,
    queue: [], workers: Array.from({ length: 3 }, () => ({ job: null })),
    processed: 0, dropped: 0, outRate: 0, wait: 0, bucket: { n: 0, t: 0 },
  };
  dots.length = 0;
  $("#q-log").innerHTML = "";
  log("Simulation reset", "ok");
}

const dots = [];
const emit = (from, to, color) => { if (dots.length < 300) dots.push({ from, to, color, t0: performance.now(), dur: 520 + Math.random() * 160 }); };

const logState = {};
function log(text, kind = "info", key, gap = 3) {
  if (key) { if (S.t - (logState[key] ?? -99) < gap) return; logState[key] = S.t; }
  const li = document.createElement("li");
  li.className = kind;
  li.innerHTML = `<time>${S.t.toFixed(1)}s</time><span>${Kit.esc(text)}</span>`;
  const ol = $("#q-log"); ol.prepend(li);
  while (ol.children.length > 40) ol.lastChild.remove();
}

/* ---------- simulation step ---------- */
function step(dt) {
  S.t += dt;
  S.acc += S.rate * dt;
  while (S.acc >= 1) { S.acc--; arrive(); }
  S.workers.forEach((w, i) => {
    if (w.job && S.t >= w.job.until) {
      S.processed++; S.bucket.n++; w.job = null;
      emit({ k: "worker", i }, { k: "out", i }, "ok");
    }
    if (!w.job && S.queue.length) {
      const m = S.queue.shift();
      S.wait = S.wait * 0.9 + (S.t - m.t) * 0.1;
      w.job = { start: S.t, until: S.t + SERVICE * (0.7 + Math.random() * 0.6) };
      emit({ k: "queue" }, { k: "worker", i }, "q-in");
    }
  });
  if (S.t - S.bucket.t >= 1) { S.outRate = S.outRate * 0.5 + (S.bucket.n / (S.t - S.bucket.t)) * 0.5; S.bucket = { n: 0, t: S.t }; }
}

function arrive() {
  if (S.queue.length >= S.cap) {
    S.dropped++;
    emit({ k: "producer" }, { k: "drop" }, "bad");
    log(`Queue full at ${S.cap}, dropping messages`, "bad", "full", 4);
    return;
  }
  S.queue.push({ t: S.t });
  emit({ k: "producer" }, { k: "queue" }, "q-in");
}

/* ---------- drawing ---------- */
const Q = { x: 250, y: 118, w: 330, h: 64 };
const workerY = (i, n) => H / 2 + (i - (n - 1) / 2) * Math.min(56, (H - 60) / Math.max(1, n));
function point(p) {
  const n = S.workers.length;
  switch (p.k) {
    case "producer": return { x: 170, y: H / 2 };
    case "queue": return { x: Q.x + Q.w, y: H / 2 };
    case "worker": return { x: 690, y: workerY(p.i, n) };
    case "out": return { x: 840, y: workerY(p.i, n) };
    case "drop": return { x: Q.x + 10, y: H - 18 };
  }
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function text(ctx, s, x, y, size, color, weight = 500, align = "left", font = Kit.font.sans) {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
}

function draw(now) {
  const { ctx } = Kit.fitCanvas(cv, W, H, { min: 0.6, max: 1.3 });
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C["q-grid"];
  for (let x = 10; x < W; x += 20) for (let y = 10; y < H; y += 20) ctx.fillRect(x, y, 1.5, 1.5);

  // producer
  ctx.fillStyle = C.card; ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  rr(ctx, 30, H / 2 - 40, 140, 80, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C["q-in"]; rr(ctx, 30, H / 2 - 30, 3, 60, 2); ctx.fill();
  text(ctx, "Producer", 46, H / 2 - 8, 14, C.fg, 600);
  text(ctx, `${S.rate} msg/s`, 46, H / 2 + 14, 12.5, C.muted, 500, "left", Kit.font.mono);

  // queue
  const fill = Math.min(1, S.queue.length / S.cap);
  ctx.fillStyle = C.card; rr(ctx, Q.x, Q.y, Q.w, Q.h, 12); ctx.fill();
  ctx.strokeStyle = fill >= 1 ? C.bad : C.border; ctx.lineWidth = fill >= 1 ? 1.5 : 1; ctx.stroke();
  ctx.fillStyle = fill >= 1 ? C.bad : fill > 0.7 ? C.warn : C["q-in"];
  ctx.globalAlpha = 0.16; rr(ctx, Q.x + 4, Q.y + 4, (Q.w - 8) * fill, Q.h - 8, 9); ctx.fill(); ctx.globalAlpha = 1;
  const cells = Math.min(S.queue.length, 60);
  for (let i = 0; i < cells; i++) {
    const cx = Q.x + Q.w - 16 - (i % 30) * 10, cy = Q.y + 18 + Math.floor(i / 30) * 22;
    rr(ctx, cx, cy, 7, 16, 2); ctx.fill();
  }
  text(ctx, "Queue", Q.x, Q.y - 12, 13, C.fg, 600);
  text(ctx, `${S.queue.length} / ${S.cap}`, Q.x + Q.w, Q.y - 12, 12.5, fill >= 1 ? C.bad : C.muted, 500, "right", Kit.font.mono);

  // links
  ctx.strokeStyle = C.border; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(170, H / 2); ctx.lineTo(Q.x, H / 2); ctx.stroke();
  S.workers.forEach((_, i) => { const y = workerY(i, S.workers.length); ctx.beginPath(); ctx.moveTo(Q.x + Q.w, H / 2); ctx.lineTo(668, y); ctx.stroke(); });
  ctx.setLineDash([]);

  // workers
  S.workers.forEach((w, i) => {
    const y = workerY(i, S.workers.length);
    ctx.fillStyle = C.card; ctx.strokeStyle = C.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(690, y, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (w.job) {
      const p = Math.min(1, (S.t - w.job.start) / (w.job.until - w.job.start));
      ctx.strokeStyle = C["q-worker"]; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(690, y, 20, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke(); ctx.lineCap = "butt";
    }
    text(ctx, `W${i + 1}`, 690, y + 4, 11.5, w.job ? C["q-worker"] : C.faint, 600, "center");
  });

  // moving dots
  for (let i = dots.length - 1; i >= 0; i--) {
    const d = dots[i], p = (now - d.t0) / d.dur;
    if (p >= 1) { dots.splice(i, 1); continue; }
    const a = point(d.from), b = point(d.to); if (!a || !b) { dots.splice(i, 1); continue; }
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    ctx.fillStyle = C[d.color] || C.fg;
    ctx.globalAlpha = d.color === "bad" ? 1 - p * 0.6 : 1;
    ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ---------- panel + stats ---------- */
function renderUi() {
  const cap = S.workers.length / SERVICE;
  const over = S.rate > cap;
  const stats = [
    ["Arriving / s", S.rate.toFixed(0), ""],
    ["Processed / s", S.outRate.toFixed(1), "ok"],
    ["In queue", String(S.queue.length), S.queue.length >= S.cap ? "bad" : S.queue.length > S.cap * 0.7 ? "warn" : ""],
    ["Avg wait", S.wait.toFixed(2) + "s", S.wait > 2 ? "warn" : ""],
    ["Dropped", String(S.dropped), S.dropped ? "bad" : ""],
  ];
  $("#q-stats").innerHTML = stats.map(([l, v, c]) => `<div class="stat ${c}"><b>${v}</b><span>${l}</span></div>`).join("");
  $("#q-depth").textContent = S.queue.length;
  $("#q-age").textContent = (S.queue.length ? S.t - S.queue[0].t : 0).toFixed(1) + "s";
  $("#q-capacity").textContent = `${cap.toFixed(0)} msg/s${over ? " (overloaded)" : ""}`;
  $("#q-workers").textContent = S.workers.length;
}

/* ---------- controls ---------- */
$("#q-rate").addEventListener("input", (e) => { S.rate = +e.target.value; $("#q-rate-v").textContent = S.rate; });
$("#q-cap").addEventListener("change", (e) => { S.cap = Math.max(5, Math.min(500, +e.target.value || 60)); e.target.value = S.cap; log(`Queue capacity set to ${S.cap}`); });
root.querySelectorAll("[data-workers]").forEach((b) => b.addEventListener("click", () => {
  const d = +b.dataset.workers;
  if (d > 0 && S.workers.length < 8) { S.workers.push({ job: null }); log(`Worker added, ${S.workers.length} running`, "ok"); }
  if (d < 0 && S.workers.length > 1) { S.workers.pop(); log(`Worker removed, ${S.workers.length} running`); }
}));
$("#q-kill").addEventListener("click", () => {
  if (S.workers.length <= 1) return;
  const w = S.workers.pop();
  if (w.job) { S.queue.unshift({ t: S.t }); log("Worker killed mid-message, its message went back to the queue", "bad"); }
  else log("Worker killed", "bad");
});
$("#q-burst").addEventListener("click", () => { for (let i = 0; i < 50; i++) arrive(); log("Burst of 50 messages", "warn"); });
$("#q-reset").addEventListener("click", reset);
$("#q-pause").addEventListener("click", (e) => { S.paused = !S.paused; e.target.textContent = S.paused ? "Resume" : "Pause"; });

/* ---------- go ---------- */
reset();
let lastUi = 0;
Kit.ready.then(() => Kit.loop((dt, now) => {
  if (!S.paused) step(dt);
  draw(now);
  if (now - lastUi > 200) { lastUi = now; renderUi(); }
}));
