/* Papangue :: scroll orchestration
   Base mode (always on, including prefers-reduced-motion or CDN unavailable):
     · progress thread (--progress), active chapter in the rail, IO reveals
   Enhanced mode (GSAP + ScrollTrigger + Lenis loaded, no reduced-motion):
     · Lenis scroll inertia, smooth anchors
     · depth: the covered scene recedes and fades out
     · entry parallax (chapter number, receipt, hero decor)
     · receipts that "print" line by line, barcode unrolling
     · ticker whose speed follows the scroll, magnetic buttons
*/

(function () {
  "use strict";

  var scenes = Array.prototype.slice.call(document.querySelectorAll("[data-scene]"));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll("[data-rail]"));
  var thread = document.querySelector(".thread");
  var mainEl = document.querySelector("main");
  var ticking = false;

  // Flow position of a scene, immune to sticky. Gotcha: offsetTop of a
  // "stuck" scene returns its on-screen position (so the current scroll),
  // not its place in the page, so targeting it can never scroll back up.
  // Heights are not affected, so we sum those of the preceding scenes.
  function flowTop(el) {
    var idx = scenes.indexOf(el);
    if (idx === -1) return el.offsetTop;
    var y = mainEl ? mainEl.offsetTop : 0;
    for (var i = 0; i < idx; i++) y += scenes[i].offsetHeight;
    return y;
  }

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var enhanced = !prefersReduced && !!(window.gsap && window.ScrollTrigger && window.Lenis);

  /* ---------- thread + rail (all modes) ---------- */

  function update() {
    ticking = false;

    var scrollY = window.scrollY;
    var viewport = window.innerHeight;

    var max = document.documentElement.scrollHeight - viewport;
    var progress = max > 0 ? Math.min(scrollY / max, 1) : 0;
    if (thread) thread.style.setProperty("--progress", progress.toFixed(4));

    // Active chapter: cumulative flow positions (see flowTop).
    var probe = scrollY + viewport * 0.5;
    var active = 0;
    var y = mainEl ? mainEl.offsetTop : 0;
    for (var i = 0; i < scenes.length; i++) {
      if (y <= probe) active = i;
      y += scenes[i].offsetHeight;
    }
    for (var j = 0; j < railLinks.length; j++) {
      railLinks[j].classList.toggle("is-active", j === active);
    }

    // Expose the active chapter to CSS (wordmark color, etc.).
    if (document.body.dataset.chapter !== String(active)) {
      document.body.dataset.chapter = String(active);
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  /* ---------- reveals (all modes) ---------- */

  var reveals = document.querySelectorAll("[data-reveal]");

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- hero dot field (all modes) ---------- */
  // Multicolored dots (no blue: that is the background) in organic drift,
  // with twinkling and gentle repulsion around the pointer.
  (function heroDots() {
    var canvas = document.querySelector(".hero-dots");
    var hero = document.getElementById("intro");
    if (!canvas || !hero || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var COLORS = ["#FFC933", "#7CF2C0", "#FF5C8A", "#FFFDF6"];
    var dots = [];
    var w = 0, h = 0;
    var mouse = { x: -1e4, y: -1e4 };
    var running = false;
    var rafId = null;
    var t0 = performance.now();

    function seed() {
      var count = Math.min(140, Math.round((w * h) / 14000));
      dots = [];
      for (var i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1.5 + Math.random() * 3.5,
          c: COLORS[i % COLORS.length],
          alpha: 0.35 + Math.random() * 0.55,
          // two stacked sine waves = organic drift
          amp1: 14 + Math.random() * 26,
          amp2: 6 + Math.random() * 14,
          spd1: 0.00012 + Math.random() * 0.00018,
          spd2: 0.00007 + Math.random() * 0.00012,
          ph1: Math.random() * Math.PI * 2,
          ph2: Math.random() * Math.PI * 2,
          ox: 0, oy: 0,
          // opening dispersion: grouped start at the center, staggered
          delay: Math.random() * 500,
          dur: 800 + Math.random() * 900
        });
      }
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var newW = hero.clientWidth;
      var newH = hero.clientHeight;
      var reseed = Math.abs(newW - w) > 4 || dots.length === 0;
      w = newW; h = newH;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reseed) seed();
    }

    function frame(now) {
      var t = now - t0;
      var cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];

        // Progress of the initial dispersion (easeOutQuint):
        // 0 = grouped at the center, 1 = at its final place.
        var p = (t - d.delay) / d.dur;
        p = p < 0 ? 0 : (p > 1 ? 1 : p);
        var e = 1 - Math.pow(1 - p, 5);

        var bx = cx + (d.x - cx) * e;
        var by = cy + (d.y - cy) * e;
        var x = bx + (Math.sin(t * d.spd1 + d.ph1) * d.amp1 + Math.sin(t * d.spd2 + d.ph2) * d.amp2) * e;
        var y = by + (Math.cos(t * d.spd1 * 0.9 + d.ph2) * d.amp1 + Math.cos(t * d.spd2 * 1.3 + d.ph1) * d.amp2) * e;

        var dx = x - mouse.x, dy = y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var push = dist < 150 ? (1 - dist / 150) * 42 : 0;
        d.ox += (push * dx / dist - d.ox) * 0.08;
        d.oy += (push * dy / dist - d.oy) * 0.08;

        var twinkle = 0.75 + 0.25 * Math.sin(t * 0.001 + d.ph1 * 3);
        ctx.globalAlpha = d.alpha * twinkle * (0.25 + 0.75 * e);
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.arc(x + d.ox, y + d.oy, d.r * (0.4 + 0.6 * e), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (running) rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (!running) { running = true; rafId = window.requestAnimationFrame(frame); }
    }
    function stop() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
    }

    resize();
    window.addEventListener("resize", resize);

    // A single still frame, dispersion already over (t well past delay+max dur).
    if (prefersReduced) { frame(t0 + 10000); return; }

    window.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });

    // Only animate while the hero is on screen.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) start(); else stop();
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }
  })();

  if (!enhanced) {
    // Same fix for base mode: the browser targets the apparent position
    // of a stuck sticky scene (0) and so never scrolls back up.
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (event) {
        var target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        window.scrollTo({ top: flowTop(target), behavior: prefersReduced ? "auto" : "smooth" });
      });
    });
    return;
  }

  /* ================== enhanced mode ================== */

  gsap.registerPlugin(ScrollTrigger);

  var lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  // Internal anchors driven by Lenis, to the flow position (flowTop).
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(flowTop(target), { duration: 1.2 });
    });
  });

  // The receipt prints line by line when it enters the screen.
  document.querySelectorAll(".receipt").forEach(function (receipt) {
    var lines = receipt.querySelectorAll("li, .receipt-total");
    var barcode = receipt.querySelector(".barcode");

    var tl = gsap.timeline({
      scrollTrigger: { trigger: receipt, start: "top 78%", once: true }
    });
    tl.from(lines, { opacity: 0, y: -10, duration: 0.35, stagger: 0.09, ease: "power2.out" });
    if (barcode) {
      tl.from(barcode, { scaleX: 0, transformOrigin: "left center", duration: 0.5, ease: "power3.out" }, "-=0.1");
    }
  });

  // Ticker: page scrolling dictates the speed of the strip.
  var track = document.querySelector(".ticker-track");
  if (track) {
    track.closest(".ticker").classList.add("ticker--js");
    var tickerTween = gsap.to(track, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
    lenis.on("scroll", function (e) {
      var boost = 1 + Math.min(Math.abs(e.velocity) / 6, 3);
      gsap.to(tickerTween, { timeScale: boost, duration: 0.25, overwrite: true });
    });
  }

  // Magnetic buttons (pointer only).
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".btn").forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - r.left - r.width / 2) * 0.25,
          y: (e.clientY - r.top - r.height / 2) * 0.35,
          duration: 0.3
        });
      });
      btn.addEventListener("mouseleave", function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
      });
    });
  }

  // Effects tied to sticky stacking: desktop only.
  var mm = gsap.matchMedia();
  mm.add("(min-width: 900px)", function () {

    scenes.forEach(function (scene, i) {
      if (i === 0) return;

      // Depth: while scene i covers the previous one,
      // that one's content recedes and fades out.
      var prevWrap = scenes[i - 1].querySelector(".wrap");
      if (prevWrap) {
        gsap.to(prevWrap, {
          scale: 0.92,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: { trigger: scene, start: "top bottom", end: "top top", scrub: true }
        });
      }
    });

    // Entry parallax: the large number and the receipt rise more
    // slowly than the scene carrying them.
    scenes.forEach(function (scene) {
      var entry = { trigger: scene, start: "top bottom", end: "top top", scrub: true };
      var num = scene.querySelector(".chapter-num");
      var receipt = scene.querySelector(".receipt");
      if (num) gsap.from(num, { y: 170, ease: "none", scrollTrigger: entry });
      if (receipt) gsap.from(receipt, { y: 110, ease: "none", scrollTrigger: entry });
    });

    // Hero decor: the dot field drifts upward while the next
    // scene covers the hero (depth effect).
    if (scenes[1]) {
      gsap.to(".hero-dots", {
        y: -90,
        ease: "none",
        scrollTrigger: { trigger: scenes[1], start: "top bottom", end: "top top", scrub: true }
      });
    }
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
