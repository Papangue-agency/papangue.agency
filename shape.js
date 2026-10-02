/* Papangue :: chapter shapes
   Each chapter (01-04) holds one geometric shape (sphere or cube, see SHAPE),
   tone-on-tone with its scene color on desktop, framed so close that it is
   never seen whole. Only light models its volume.
     · entry: while the scene rises into view, the shape rolls into place
     · scroll: while the scene is covered by the next one, it keeps turning
     · idle: a very slow drift, and a slight camera parallax under the pointer
   On mobile, it takes the color of the scene's "CH.0X ↓" button and sits at
   a random spot in the lower part of the scene.
   Needs Three.js (CDN). Without it, or without WebGL, the scenes keep their
   flat color. Under prefers-reduced-motion the shapes hold their final pose.
*/

(function () {
  "use strict";

  if (!window.THREE) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var mainEl = document.querySelector("main");
  var allScenes = Array.prototype.slice.call(document.querySelectorAll("[data-scene]"));

  // Staging per chapter, in world units (camera at z = 16, fov 35).
  // pos/rot: resting pose (desktop) · narrowZ: depth on mobile, where the center is random
  // entryMove/entryRot: offset at the start of the entry
  // scrollRot: extra rotation once the scene is fully covered by the next one.
  var STAGING = {
    lancer: {
      color: 0xFFC933, size: 16,
      pos: [5.4, -1.2, 3.2], narrowZ: 1,
      rot: [0.25, 0.8, 0.55], entryRot: [0.1, -0.5, -0.35], entryMove: [4, 2, 0],
      scrollRot: [0.08, 0.45, 0.25]
    },
    structurer: {
      color: 0x0B6B49, size: 16,
      pos: [-5.8, 1.6, 2.6], narrowZ: 1,
      rot: [-0.3, -0.7, -0.4], entryRot: [-0.1, 0.5, 0.3], entryMove: [-4, -2, 0],
      scrollRot: [-0.06, -0.4, -0.2]
    },
    amplifier: {
      color: 0xFFB505, size: 15,
      pos: [6.2, 2.4, 2.8], narrowZ: 1,
      rot: [0.9, 0.35, -0.2], entryRot: [-0.3, 0.4, 0.2], entryMove: [3, -3, 0],
      scrollRot: [0.3, 0.2, -0.15]
    },
    automatiser: {
      color: 0xCD0707, size: 17,
      pos: [-5, -2.4, 3.6], narrowZ: 1,
      rot: [0.5, -0.25, 1.1], entryRot: [0.2, 0.3, -0.4], entryMove: [-3, 3, 0],
      scrollRot: [-0.2, 0.35, 0.3]
    }
  };

  // Current shape: "sphere". "cube" is the first validated version (sharp edges).
  var SHAPE = "sphere";

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sine(x) { return -(Math.cos(Math.PI * x) - 1) / 2; }

  // Flow position of a scene, immune to sticky (same reasoning as app.js).
  function flowTop(el) {
    var y = mainEl ? mainEl.offsetTop : 0;
    for (var i = 0; i < allScenes.length && allScenes[i] !== el; i++) y += allScenes[i].offsetHeight;
    return y;
  }

  function Shape(scene, cfg) {
    var canvas = scene.querySelector(".shape-canvas");
    this.scene = scene;
    this.cfg = cfg;
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(cfg.color);

    var base = new THREE.Color(cfg.color);
    this.world = new THREE.Scene();
    this.world.fog = new THREE.Fog(cfg.color, 18, 40);
    this.camera = new THREE.PerspectiveCamera(35, 1.6, 0.1, 100);
    this.camera.position.set(0, 0, 16);

    // Soft, high key light from the upper left. The sphere turns its whole
    // underside away from the light, so it gets a brighter ground bounce and
    // fill than the cube to stay tone-on-tone.
    var L = SHAPE === "sphere"
      ? { groundDark: 0.22, hemi: 0.72, key: 0.5, fill: 0.34, tint: 0.05 }
      : { groundDark: 0.5, hemi: 0.58, key: 0.62, fill: 0.18, tint: 0.02 };
    this.world.add(new THREE.HemisphereLight(0xFFFFFF, base.clone().lerp(new THREE.Color(0x000000), L.groundDark), L.hemi));
    var key = new THREE.DirectionalLight(0xFFFFFF, L.key);
    key.position.set(-7, 10, 9);
    this.world.add(key);
    var fill = new THREE.DirectionalLight(0xFFF1CC, L.fill);
    fill.position.set(8, -3, 6);
    this.world.add(fill);

    // Desktop: tone-on-tone with the scene. Mobile: the text color of the scene's
    // "CH.0X ↓" button (read from the CSS, so styles.css stays the source).
    this.toneColor = base.clone().lerp(new THREE.Color(0xFFFFFF), L.tint);
    var next = scene.querySelector(".btn--next");
    var nextInk = next ? window.getComputedStyle(next).color : "";
    this.mobileColor = /^rgb/.test(nextInk) ? new THREE.Color(nextInk) : this.toneColor;
    var material = new THREE.MeshStandardMaterial({ color: this.toneColor, roughness: 0.5, metalness: 0 });
    this.material = material;
    this.pivot = new THREE.Group();
    var geometry = SHAPE === "sphere"
      ? new THREE.SphereGeometry(cfg.size * 0.62, 128, 96)
      : new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size);
    this.mesh = new THREE.Mesh(geometry, material);
    this.pivot.add(this.mesh);
    this.world.add(this.pivot);

    // Mobile: a random center in the lower part of the view, drawn once per
    // page load, as fractions of the visible half-width / half-height.
    this.mobileSpot = [Math.random() * 1.2 - 0.6, -0.45 - Math.random() * 0.45];

    this.entry = reduced ? 1 : 0;
    this.turn = 0;
    this.narrow = false;
    this.resize();
  }

  Shape.prototype.resize = function () {
    var w = this.scene.clientWidth, h = this.scene.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.narrow = w < 900;
    this.material.color.copy(this.narrow ? this.mobileColor : this.toneColor);
  };

  // Scroll targets: entry while the scene rises, turn while the next one covers it.
  Shape.prototype.targets = function (scrollY, vh) {
    var top = flowTop(this.scene);
    return {
      entry: clamp((scrollY - (top - vh)) / vh),
      turn: clamp((scrollY - top) / this.scene.offsetHeight),
      visible: scrollY > top - vh && scrollY < top + this.scene.offsetHeight
    };
  };

  Shape.prototype.render = function (t, cam) {
    var c = this.cfg, e = sine(this.entry), k = 1 - e, s = this.turn;
    var pos = c.pos;
    if (this.narrow) {
      var z = c.narrowZ;
      var halfH = Math.tan(this.camera.fov * Math.PI / 360) * (16 - z);
      pos = [this.mobileSpot[0] * halfH * this.camera.aspect, this.mobileSpot[1] * halfH, z];
    }
    var drift = reduced ? 0 : t * 0.018;
    this.pivot.scale.setScalar(this.narrow ? 0.6 : 1);
    this.pivot.position.set(
      pos[0] + k * c.entryMove[0],
      pos[1] + k * c.entryMove[1] + (reduced ? 0 : Math.sin(t * 0.35) * 0.12),
      pos[2] + k * c.entryMove[2]);
    this.mesh.rotation.set(
      c.rot[0] + k * c.entryRot[0] + s * c.scrollRot[0] + (reduced ? 0 : Math.sin(t * 0.21) * 0.02),
      c.rot[1] + k * c.entryRot[1] + s * c.scrollRot[1] + drift,
      c.rot[2] + k * c.entryRot[2] + s * c.scrollRot[2]);
    this.camera.position.set(cam.x, cam.y, 16);
    this.camera.lookAt(cam.x * 0.3, cam.y * 0.3, 0);
    this.renderer.render(this.world, this.camera);
  };

  var shapes = [];
  allScenes.forEach(function (scene) {
    var cfg = STAGING[scene.id];
    if (!cfg || !scene.querySelector(".shape-canvas")) return;
    try { shapes.push(new Shape(scene, cfg)); }
    catch (err) { /* no WebGL: the flat scene color stays */ }
  });
  if (!shapes.length) return;

  var pointer = { x: 0, y: 0 }, cam = { x: 0, y: 0 };
  if (finePointer && !reduced) {
    window.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX / window.innerWidth * 2 - 1;
      pointer.y = e.clientY / window.innerHeight * 2 - 1;
    }, { passive: true });
  }

  // Scene heights change with fonts and content, not only with the window.
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { shapes.forEach(function (c) { c.resize(); }); });
    shapes.forEach(function (c) { ro.observe(c.scene); });
  } else {
    window.addEventListener("resize", function () { shapes.forEach(function (c) { c.resize(); }); });
  }

  var t = 0, last = 0;
  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    t += dt;

    var scrollY = window.scrollY, vh = window.innerHeight;
    cam.x += (pointer.x * 0.5 - cam.x) * 0.03;
    cam.y += (-pointer.y * 0.35 - cam.y) * 0.03;

    shapes.forEach(function (c) {
      var tg = c.targets(scrollY, vh);
      if (!tg.visible) return;
      if (reduced) {
        c.turn = tg.turn;
      } else {
        // Damped follow: the shape trails the scroll slightly, never snaps.
        c.entry += (tg.entry - c.entry) * 0.06;
        c.turn += (tg.turn - c.turn) * 0.06;
      }
      c.render(t, cam);
    });

    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
