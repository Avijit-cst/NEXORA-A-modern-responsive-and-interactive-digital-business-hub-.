/* ==========================================================================
   NEXORA — script.js
   Modular vanilla JS: loader, theme, nav, reveal, counters, hero chart,
   business selector, live dashboard, features, filters, slider, FAQ,
   form validation, toast, back-to-top, active link.
   ========================================================================== */
"use strict";

/* ---------- Helpers ---------- */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg, type = "success") {
  const t = $("#toast");
  t.className = "toast show " + type;
  t.querySelector("span").textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3600);
}

/* ---------- Loader (kicks off entrance observers when done) ---------- */
let introStarted = false;
function startIntro() {
  if (introStarted) return;
  introStarted = true;
  document.body.classList.remove("loading");
  const l = $("#loader");
  if (l) { l.classList.add("done"); setTimeout(() => l.remove(), 700); }
  initReveals();
  initCounters();
}
window.addEventListener("load", startIntro);
setTimeout(startIntro, 3000); // safety fallback

/* ---------- Theme toggle ---------- */
(function () {
  const root = document.documentElement, btn = $("#themeToggle");
  const apply = t => {
    root.dataset.theme = t;
    btn.innerHTML = `<i class="fa-solid ${t === "dark" ? "fa-moon" : "fa-sun"}"></i>`;
    try { localStorage.setItem("nexora-theme", t); } catch (e) {}
  };
  let saved = null;
  try { saved = localStorage.getItem("nexora-theme"); } catch (e) {}
  if (saved) apply(saved);
  btn.addEventListener("click", () => apply(root.dataset.theme === "dark" ? "light" : "dark"));
})();

/* ---------- Navbar state, progress bar, back-to-top ---------- */
const navbar = $("#navbar"), btt = $("#backToTop"), progress = $("#scrollProgress");
function onScroll() {
  const y = window.scrollY;
  navbar.classList.toggle("scrolled", y > 30);
  btt.classList.toggle("show", y > 600);
  const h = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
}
let sTick = null;
window.addEventListener("scroll", () => {
  if (!sTick) sTick = requestAnimationFrame(() => { onScroll(); sTick = null; });
}, { passive: true });
onScroll();
btt.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

/* ---------- Mobile menu ---------- */
const hamb = $("#hamburger");
function closeMenu() {
  document.body.classList.remove("menu-open");
  hamb.classList.remove("active");
  hamb.setAttribute("aria-expanded", "false");
}
hamb.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  hamb.classList.toggle("active", open);
  hamb.setAttribute("aria-expanded", open);
});
 $$("#mobileMenu a").forEach(a => a.addEventListener("click", closeMenu));

/* ---------- Scroll reveal ---------- */
function initReveals() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
    });
  }, { threshold: 0.14 });
  $$(".reveal").forEach(el => io.observe(el));
}

/* ---------- Animated counters ---------- */
function animateCounter(el) {
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.decimals || 0, 10);
  const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
  const dur = 1800;
  let t0 = null;
  const step = ts => {
    if (!t0) t0 = ts;
    const p = Math.min((ts - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = pre + fmt(target * e, dec) + suf;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function initCounters() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  $$("[data-count]").forEach(el => io.observe(el));
}

/* ---------- Hero: live morphing SVG chart ---------- */
const heroLine = $("#heroLine"), heroArea = $("#heroArea"), heroDot = $("#heroDot");
const HW = 340, HH = 140, HP = 10;
let hVals = [30, 45, 38, 58, 50, 66, 60, 74, 68, 84, 78, 92];
let heroVisible = true, heroMorph = null;

function chartPaths(vals) {
  const n = vals.length;
  const pts = vals.map((v, i) => [HP + i * (HW - 2 * HP) / (n - 1), HH - HP - (v / 100) * (HH - 2 * HP)]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return { line: d, area: d + ` L ${pts[n - 1][0]},${HH} L ${pts[0][0]},${HH} Z`, last: pts[n - 1] };
}
function setHero(vals) {
  const p = chartPaths(vals);
  heroLine.setAttribute("d", p.line);
  heroArea.setAttribute("d", p.area);
  heroDot.setAttribute("cx", p.last[0]);
  heroDot.setAttribute("cy", p.last[1]);
}
function morphHero(target) {
  const from = [...hVals], t0 = performance.now();
  cancelAnimationFrame(heroMorph);
  const step = now => {
    const p = Math.min((now - t0) / 700, 1);
    const e = 1 - Math.pow(1 - p, 3);
    hVals = from.map((v, i) => v + (target[i] - v) * e);
    setHero(hVals);
    if (p < 1) heroMorph = requestAnimationFrame(step);
  };
  heroMorph = requestAnimationFrame(step);
}
setHero(hVals);
new IntersectionObserver(e => { heroVisible = e[0].isIntersecting; }, { threshold: 0.1 })
  .observe($("#heroVisual"));

let heroRev = 48260;
const heroRevEl = $("#heroRevenue");
setInterval(() => {
  if (!heroVisible || document.hidden) return;
  morphHero(hVals.map(v => clamp(v + (Math.random() * 26 - 12), 16, 97)));
  heroRev += Math.floor(20 + Math.random() * 90);
  heroRevEl.textContent = "$" + fmt(heroRev);
}, 4000);

/* ---------- Business type selector ---------- */
const BIZ = {
  restaurant: { name: "Restaurant", accent: "#ff8a5c",
    stats: [{ v: "86", l: "Orders Today" }, { v: "24", l: "Reservations" }, { v: "42", l: "Menu Items" }],
    rows: [
      { i: "fa-bag-shopping",     t: "New order — Table 12",        s: "2 items · paid online",   tag: "+ $54" },
      { i: "fa-calendar-check",   t: "Reservation confirmed",       s: "7:30 PM · party of 4",    tag: "Today" },
      { i: "fa-utensils",         t: "Menu updated",                s: "Truffle Pasta added",     tag: "Live" },
      { i: "fa-star",             t: "New 5★ review",               s: "“Amazing service!”",      tag: "5.0" }] },
  ecommerce: { name: "E-commerce", accent: "#2fd48f",
    stats: [{ v: "248", l: "Products" }, { v: "1,284", l: "Orders" }, { v: "3,462", l: "Customers" }],
    rows: [
      { i: "fa-credit-card",      t: "New order #10248",            s: "Maya Rodriguez",          tag: "$129" },
      { i: "fa-triangle-exclamation", t: "Low stock alert",         s: "Aero Sneakers — 3 left",  tag: "Alert" },
      { i: "fa-user-plus",        t: "New customer registered",     s: "maya@mail.com",           tag: "New" },
      { i: "fa-truck-fast",       t: "Shipment out for delivery",   s: "Track #US-8841",          tag: "Transit" }] },
  salon: { name: "Salon", accent: "#e879b8",
    stats: [{ v: "18", l: "Appointments" }, { v: "214", l: "Clients" }, { v: "12", l: "Services" }],
    rows: [
      { i: "fa-calendar-check",   t: "Booking — Hair Spa",          s: "2:00 PM · Emma Wilson",   tag: "Today" },
      { i: "fa-cake-candles",     t: "Client birthday",             s: "Send a special offer",    tag: "Auto" },
      { i: "fa-spa",              t: "Service added",               s: "Keratin Treatment",       tag: "New" },
      { i: "fa-bell",             t: "Reminder sent to 6 clients",  s: "Tomorrow's bookings",     tag: "Sent" }] },
  agency: { name: "Agency", accent: "#3d7fff",
    stats: [{ v: "16", l: "Projects" }, { v: "24", l: "Clients" }, { v: "38", l: "Leads" }],
    rows: [
      { i: "fa-diagram-project",  t: "Milestone reached",           s: "Brand site — 80% done",   tag: "80%" },
      { i: "fa-phone",            t: "Discovery call booked",       s: "New lead · Thursday 3 PM", tag: "Lead" },
      { i: "fa-file-invoice-dollar", t: "Invoice #220 paid",        s: "Retainer — monthly",      tag: "$4,800" },
      { i: "fa-comments",         t: "Client feedback received",    s: "Approved design v2",      tag: "OK" }] },
  fitness: { name: "Fitness", accent: "#3ddc97",
    stats: [{ v: "342", l: "Members" }, { v: "26", l: "Classes" }, { v: "8", l: "Trainers" }],
    rows: [
      { i: "fa-user-plus",        t: "New member joined",           s: "Alex Johnson — Premium",  tag: "New" },
      { i: "fa-fire",             t: "Class is full",               s: "HIIT · 6:00 AM",          tag: "24/24" },
      { i: "fa-calendar-days",    t: "Trainer schedule updated",    s: "Coach Mia — next week",   tag: "Sync" },
      { i: "fa-heart-pulse",      t: "Membership renewal",          s: "12 memberships this week", tag: "+12" }] }
};
const bizPanel = $("#bizDemo"), bizTitle = $("#bizTitle"), bizStats = $("#bizStats"), bizRows = $("#bizRows");
function renderBiz(key) {
  const d = BIZ[key];
  bizTitle.textContent = d.name;
  bizPanel.style.setProperty("--ac", d.accent);
  bizStats.innerHTML = d.stats.map(s => `<div class="bp-stat"><span class="bp-num">${s.v}</span><span class="bp-label">${s.l}</span></div>`).join("");
  bizRows.innerHTML = d.rows.map(r => `
    <div class="bp-row"><span class="bp-ico"><i class="fa-solid ${r.i}"></i></span>
    <div class="bp-txt"><strong>${r.t}</strong><small>${r.s}</small></div>
    <span class="bp-tag">${r.tag}</span></div>`).join("");
}
renderBiz("restaurant");
 $$(".biz-card").forEach(card => card.addEventListener("click", () => {
  if (card.classList.contains("active")) return;
  $$(".biz-card").forEach(c => c.classList.remove("active"));
  card.classList.add("active");
  bizPanel.classList.add("switching");
  setTimeout(() => { renderBiz(card.dataset.biz); bizPanel.classList.remove("switching"); }, 280);
}));

/* ---------- Smart dashboard demo ---------- */
const bars = $$("#demoBars .bar");
let dVals = [], demoVisible = false, barsPainted = false;
const genBar = () => Math.round(clamp(28 + Math.random() * 58, 12, 96));
const genVals = n => Array.from({ length: n }, (_, i) =>
  Math.round(clamp(30 + i * 3.2 + Math.sin(i * 0.9) * 12 + Math.random() * 16, 12, 96)));
function paintBars() {
  bars.forEach(b => { b.style.height = b._v + "%"; b.dataset.v = "$" + fmt(b._v * 137); });
}
dVals = genVals(12);
bars.forEach((b, i) => { b._v = dVals[i]; });
function refreshBars(vals) {
  dVals = vals;
  bars.forEach((b, i) => { b._v = dVals[i]; });
  paintBars();
}
new IntersectionObserver(e => {
  demoVisible = e[0].isIntersecting;
  if (demoVisible && !barsPainted) { barsPainted = true; paintBars(); }
}, { threshold: 0.2 }).observe($("#dashboard"));

// Live stream: shift + push new bar, bump orders counter
let liveOrders = 1284;
const liveOrdersEl = $("#liveOrders");
setInterval(() => {
  if (!demoVisible || document.hidden) return;
  dVals.shift(); dVals.push(genBar());
  refreshBars(dVals);
  liveOrders += 1 + Math.floor(Math.random() * 3);
  liveOrdersEl.textContent = fmt(liveOrders);
}, 3200);

// Range cycle button
const RANGES = [{ label: "Daily", amp: 1 }, { label: "Weekly", amp: 1.22 }, { label: "Monthly", amp: 0.82 }];
let ri = 0;
 $("#demoRange").addEventListener("click", () => {
  ri = (ri + 1) % RANGES.length;
  $("#rangeLabel").textContent = RANGES[ri].label;
  refreshBars(dVals.map(v => Math.round(clamp(v * RANGES[ri].amp, 12, 96))));
});
 $("#exportBtn").addEventListener("click", () => showToast("Report exported — check your downloads (demo)."));

// Tabs
 $$(".dd-tab").forEach(tab => tab.addEventListener("click", () => {
  $$(".dd-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  $$(".dd-panel").forEach(p => p.classList.toggle("active", p.id === tab.dataset.tab));
}));

/* ---------- Interactive features ---------- */
 $$(".feat-item").forEach(btn => btn.addEventListener("click", () => {
  $$(".feat-item").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  $$(".feat-view").forEach(v => v.classList.toggle("active", v.id === btn.dataset.view));
}));

/* ---------- Showcase filtering ---------- */
const projs = $$(".proj");
 $$(".filter-btn").forEach(btn => btn.addEventListener("click", () => {
  $$(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.filter;
  projs.forEach(p => {
    const match = f === "all" || p.dataset.category === f;
    clearTimeout(p._t);
    if (match) {
      p.style.display = "";
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.remove("hide")));
    } else {
      p.classList.add("hide");
      p._t = setTimeout(() => { p.style.display = "none"; }, 320);
    }
  });
}));

/* ---------- Project image fallback (graceful CSS placeholders) ---------- */
 $$(".proj-media img").forEach(img => {
  const media = img.closest(".proj-media");
  img.addEventListener("error", () => img.remove());          // missing file → keep CSS mockup
  img.addEventListener("load",  () => media.classList.add("has-img"));
  if (img.complete && img.naturalWidth > 0) media.classList.add("has-img");
});

/* ---------- Testimonial slider ---------- */
(function () {
  const track = $("#tTrack"), slides = [...track.children], dotsEl = $("#tDots");
  let idx = 0, timer;
  slides.forEach((_, i) => {
    const d = document.createElement("button");
    d.className = "t-dot"; d.setAttribute("aria-label", "Go to testimonial " + (i + 1));
    d.addEventListener("click", () => go(i, true));
    dotsEl.appendChild(d);
  });
  function go(i, user) {
    idx = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
    [...dotsEl.children].forEach((d, j) => d.classList.toggle("active", j === idx));
    if (user) restart();
  }
  function restart() { clearInterval(timer); timer = setInterval(() => go(idx + 1), 5500); }
  $("#tPrev").addEventListener("click", () => go(idx - 1, true));
  $("#tNext").addEventListener("click", () => go(idx + 1, true));
  $("#tSlider").addEventListener("mouseenter", () => clearInterval(timer));
  $("#tSlider").addEventListener("mouseleave", restart);
  go(0); restart();
})();

/* ---------- FAQ accordion (one open at a time) ---------- */
 $$(".faq-item").forEach(item => {
  const q = item.querySelector(".faq-q");
  q.addEventListener("click", () => {
    const wasOpen = item.classList.contains("open");
    $$(".faq-item.open").forEach(o => {
      o.classList.remove("open");
      o.querySelector(".faq-q").setAttribute("aria-expanded", "false");
    });
    if (!wasOpen) { item.classList.add("open"); q.setAttribute("aria-expanded", "true"); }
  });
});

/* ---------- Contact form validation ---------- */
const form = $("#contactForm");
const RULES = {
  name:    { min: 2, msg: "Please enter your name (min. 2 characters)." },
  email:   { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: "Please enter a valid email address." },
  biztype: { required: true, msg: "Please select your business type." },
  budget:  { required: true, msg: "Please select a budget range." },
  message: { min: 10, msg: "Tell us a bit more (min. 10 characters)." }
};
function setFieldError(input, msg) {
  const field = input.closest(".field");
  field.classList.toggle("invalid", !!msg);
  field.querySelector(".err").textContent = msg || "";
}
function validateField(name) {
  const input = form.elements[name], rule = RULES[name], v = input.value.trim();
  if (rule.required && !v) return setFieldError(input, rule.msg), false;
  if (rule.min && v.length < rule.min) return setFieldError(input, rule.msg), false;
  if (rule.pattern && !rule.pattern.test(v)) return setFieldError(input, rule.msg), false;
  setFieldError(input, "");
  return true;
}
Object.keys(RULES).forEach(name => {
  const input = form.elements[name];
  input.addEventListener("input", () => validateField(name));
  input.addEventListener("change", () => validateField(name));
});
form.addEventListener("submit", e => {
  e.preventDefault();
  const ok = Object.keys(RULES).map(validateField).every(Boolean);
  if (!ok) { showToast("Please fix the highlighted fields.", "error"); return; }
  const btn = $("#submitBtn"), original = btn.innerHTML;
  btn.classList.add("sending");
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
  setTimeout(() => {
    btn.classList.remove("sending");
    btn.innerHTML = original;
    form.reset();
    $("#formSuccess").classList.add("show");
    showToast("Message sent! We'll reply within one business day.");
    setTimeout(() => $("#formSuccess").classList.remove("show"), 6000);
  }, 1300);
});

/* ---------- Active navigation link ---------- */
const navIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      $$(".nav-links a").forEach(a =>
        a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
    }
  });
}, { rootMargin: "-42% 0px -52% 0px" });
 $$("main section[id]").forEach(s => navIO.observe(s));

/* ---------- Placeholder demo links ---------- */
 $$('a[href="#"]').forEach(a => a.addEventListener("click", e => {
  e.preventDefault();
  showToast("Demo link — connect your real profile here.", "info");
}));