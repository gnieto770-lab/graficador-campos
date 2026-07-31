(function () {
  "use strict";
  /* ∇armandocf — main.js
     Motor de campos vectoriales + escena 3D (Three.js) + UI.
     Classic script (IIFE). Sin módulos, sin build. */

  /* ---------- Helpers ---------- */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const data = window.__BRAND__ || {};
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }

  /* =============================================================
     1. Parser de expresiones matemáticas → f(x, y, z)
        Tokenizer + Shunting-yard → RPN → intérprete de pila.
        No usa eval ni new Function.
     ============================================================= */
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log,
    sqrt: Math.sqrt, abs: Math.abs, sign: Math.sign,
    floor: Math.floor, ceil: Math.ceil, round: Math.round
  };
  const CONSTS = { pi: Math.PI, e: Math.E };
  const OPS = {
    "+": { prec: 2, assoc: "L", fn: (a, b) => a + b },
    "-": { prec: 2, assoc: "L", fn: (a, b) => a - b },
    "*": { prec: 3, assoc: "L", fn: (a, b) => a * b },
    "/": { prec: 3, assoc: "L", fn: (a, b) => a / b },
    "^": { prec: 4, assoc: "R", fn: (a, b) => Math.pow(a, b) }
  };

  function tokenize(str) {
    const t = []; let i = 0; const s = str.replace(/\s+/g, "");
    const isDigit = c => c >= "0" && c <= "9";
    const isAlpha = c => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
    while (i < s.length) {
      const c = s[i];
      if (isDigit(c) || (c === "." && isDigit(s[i + 1]))) {
        let num = ""; while (i < s.length && (isDigit(s[i]) || s[i] === ".")) num += s[i++];
        t.push({ type: "num", value: parseFloat(num) }); continue;
      }
      if (isAlpha(c)) {
        let id = ""; while (i < s.length && (isAlpha(s[i]) || isDigit(s[i]))) id += s[i++];
        if (s[i] === "(" && FUNCS[id]) t.push({ type: "func", value: id });
        else if (id === "x" || id === "y" || id === "z") t.push({ type: "var", value: id });
        else if (CONSTS[id] != null) t.push({ type: "num", value: CONSTS[id] });
        else if (FUNCS[id]) t.push({ type: "func", value: id });
        else throw new Error("desconocido: " + id);
        continue;
      }
      if (c in OPS) { t.push({ type: "op", value: c }); i++; continue; }
      if (c === "(") { t.push({ type: "lp" }); i++; continue; }
      if (c === ")") { t.push({ type: "rp" }); i++; continue; }
      if (c === ",") { t.push({ type: "comma" }); i++; continue; }
      throw new Error("símbolo: " + c);
    }
    return t;
  }

  // Inserta multiplicación implícita (2x, xy, )(, x(...)) y unarios +/-
  function normalize(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i], prev = out[out.length - 1];
      // unario: - o + al inicio o tras op/lp/comma → 0 - a
      if (tk.type === "op" && (tk.value === "-" || tk.value === "+")) {
        const start = !prev || prev.type === "op" || prev.type === "lp" || prev.type === "comma";
        if (start) { out.push({ type: "num", value: 0 }); out.push(tk); if (prev && prev.type === "op") {} ; }
        else { out.push(tk); }
        continue;
      }
      // multiplicación implícita
      if (prev) {
        const prevEnd = prev.type === "num" || prev.type === "var" || prev.type === "rp";
        const curStart = tk.type === "num" || tk.type === "var" || tk.type === "func" || tk.type === "lp";
        if (prevEnd && curStart) out.push({ type: "op", value: "*" });
      }
      out.push(tk);
    }
    return out;
  }

  function toRPN(tokens) {
    const out = [], stack = [];
    for (const tk of tokens) {
      if (tk.type === "num" || tk.type === "var") out.push(tk);
      else if (tk.type === "func") stack.push(tk);
      else if (tk.type === "op") {
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === "op" &&
             (OPS[top.value].prec > OPS[tk.value].prec ||
             (OPS[top.value].prec === OPS[tk.value].prec && OPS[tk.value].assoc === "L"))) {
            out.push(stack.pop());
          } else break;
        }
        stack.push(tk);
      } else if (tk.type === "lp") stack.push(tk);
      else if (tk.type === "rp") {
        while (stack.length && stack[stack.length - 1].type !== "lp") out.push(stack.pop());
        if (!stack.length) throw new Error("paréntesis");
        stack.pop();
        if (stack.length && stack[stack.length - 1].type === "func") out.push(stack.pop());
      }
    }
    while (stack.length) { const s = stack.pop(); if (s.type === "lp") throw new Error("paréntesis"); out.push(s); }
    return out;
  }

  // Compila a función (x,y,z) => number ejecutando la RPN sobre una pila.
  function compile(expr) {
    if (!expr || !expr.trim()) return () => 0;
    const rpn = toRPN(normalize(tokenize(expr)));
    // validación rápida evaluando en (1,1,1)
    const fn = (x, y, z) => {
      const st = [];
      for (const tk of rpn) {
        if (tk.type === "num") st.push(tk.value);
        else if (tk.type === "var") st.push(tk.value === "x" ? x : tk.value === "y" ? y : z);
        else if (tk.type === "op") { const b = st.pop(), a = st.pop(); st.push(OPS[tk.value].fn(a, b)); }
        else if (tk.type === "func") { const a = st.pop(); st.push(FUNCS[tk.value](a)); }
      }
      if (st.length !== 1) throw new Error("expresión incompleta");
      return st[0];
    };
    fn(1, 0.5, -0.3); // dispara errores estructurales ya
    return fn;
  }

  /* =============================================================
     2. Colormap calmo (frío → cálido) por magnitud
     ============================================================= */
  const STOPS = [
    [0.00, [58, 125, 122]],   // teal
    [0.35, [90, 166, 160]],   // sage claro
    [0.60, [201, 178, 108]],  // arena
    [0.82, [196, 122, 74]],   // terracota
    [1.00, [168, 74, 60]]     // terracota profundo
  ];
  function colorAt(t) {
    t = clamp(t, 0, 1);
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i];
        const k = (t - t0) / (t1 - t0 || 1);
        return [
          (c0[0] + (c1[0] - c0[0]) * k) / 255,
          (c0[1] + (c1[1] - c0[1]) * k) / 255,
          (c0[2] + (c1[2] - c0[2]) * k) / 255
        ];
      }
    }
    const c = STOPS[STOPS.length - 1][1];
    return [c[0] / 255, c[1] / 255, c[2] / 255];
  }

  /* =============================================================
     3. Escena Three.js
     ============================================================= */
  const Scene = {
    ok: false,
    init(container) {
      if (!window.THREE) return;
      const THREE = window.THREE;
      if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;

      this.THREE = THREE;
      this.container = container;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(w, h);
      container.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
      this.camera.up.set(0, 0, 1);
      this.target = new THREE.Vector3(0, 0, 0);

      this.group = new THREE.Group();
      this.scene.add(this.group);
      this.decor = new THREE.Group();
      this.scene.add(this.decor);

      // Controles (esféricos, propios)
      this.radius = 16; this.theta = Math.PI * 0.28; this.phi = Math.PI * 0.42;
      this.mode = "2d"; this.autorotate = true; this.showAxes = true;
      this._initControls();
      this._applyCamera();

      this.ok = true;
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);

      const ro = new ResizeObserver(() => this.resize());
      ro.observe(container);
      window.addEventListener("resize", () => this.resize());
    },

    _applyCamera() {
      const T = this.target;
      if (this.mode === "2d") {
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(T.x, T.y, T.z + this.radius);
      } else {
        this.camera.up.set(0, 0, 1);
        const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
        this.camera.position.set(
          T.x + this.radius * sp * Math.cos(this.theta),
          T.y + this.radius * sp * Math.sin(this.theta),
          T.z + this.radius * cp
        );
      }
      this.camera.lookAt(T);
    },

    _syncSpherical() {
      // Recalcula theta/phi/radius desde la posición actual (tras animación)
      const d = this.camera.position.clone().sub(this.target);
      this.radius = d.length();
      this.phi = Math.acos(clamp(d.z / this.radius, -1, 1));
      this.theta = Math.atan2(d.y, d.x);
    },

    _initControls() {
      const el = this.renderer.domElement;
      let dragging = false, mode = null, px = 0, py = 0;
      const pointers = new Map();

      const onDown = (e) => {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dragging = true; px = e.clientX; py = e.clientY;
        mode = (e.button === 2 || e.shiftKey) ? "pan" : "rotate";
        this.autorotate = false; syncSwitch("rotate", false);
      };
      const onMove = (e) => {
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // pinch (dos punteros)
        if (pointers.size === 2) { this._pinch(pointers); return; }
        if (!dragging) return;
        const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
        if (mode === "pan" || this.mode === "2d") this._pan(dx, dy);
        else this._rotate(dx, dy);
      };
      const onUp = (e) => {
        pointers.delete(e.pointerId); if (pointers.size === 0) dragging = false;
        if (pointers.size < 2) this._pinchPrev = 0;
      };
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      el.addEventListener("wheel", (e) => {
        e.preventDefault();
        this.radius = clamp(this.radius * (e.deltaY > 0 ? 1.08 : 0.92), 3, 200);
        this._applyCamera();
      }, { passive: false });
      this._pinchPrev = 0;
    },

    _rotate(dx, dy) {
      if (this.mode === "2d") return;
      this.theta -= dx * 0.008;
      this.phi = clamp(this.phi - dy * 0.008, 0.12, Math.PI - 0.12);
      this._applyCamera();
    },
    _pan(dx, dy) {
      const THREE = this.THREE;
      const right = new THREE.Vector3(), up = new THREE.Vector3();
      this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      const k = this.radius * 0.0016;
      this.target.addScaledVector(right, -dx * k);
      this.target.addScaledVector(up, dy * k);
      this._applyCamera();
    },
    _pinch(pointers) {
      const p = Array.from(pointers.values());
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (this._pinchPrev) {
        this.radius = clamp(this.radius * (this._pinchPrev / dist), 3, 200);
        this._applyCamera();
      }
      this._pinchPrev = dist;
    },

    setMode(mode, animate) {
      const THREE = this.THREE;
      const wasAuto = this.autorotate;
      this.mode = mode;
      const T = this.target;
      let toPos, toUp;
      if (mode === "2d") {
        toUp = new THREE.Vector3(0, 1, 0);
        toPos = new THREE.Vector3(T.x, T.y, T.z + this.radius);
      } else {
        toUp = new THREE.Vector3(0, 0, 1);
        const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
        toPos = new THREE.Vector3(
          T.x + this.radius * sp * Math.cos(this.theta),
          T.y + this.radius * sp * Math.sin(this.theta),
          T.z + this.radius * cp);
      }
      if (animate && window.gsap) {
        const fromPos = this.camera.position.clone();
        const fromUp = this.camera.up.clone();
        const o = { t: 0 };
        gsap.to(o, {
          t: 1, duration: 0.75, ease: "power3.inOut",
          onUpdate: () => {
            this.camera.position.lerpVectors(fromPos, toPos, o.t);
            this.camera.up.lerpVectors(fromUp, toUp, o.t).normalize();
            this.camera.lookAt(T);
          },
          onComplete: () => { if (mode === "3d") this._syncSpherical(); }
        });
      } else {
        this._applyCamera();
      }
    },

    resetView(animate) {
      this.target.set(0, 0, 0);
      if (this.mode === "3d") { this.theta = Math.PI * 0.28; this.phi = Math.PI * 0.42; }
      this.setMode(this.mode, animate);
    },

    resize() {
      if (!this.ok) return;
      const w = this.container.clientWidth, h = this.container.clientHeight;
      if (!w || !h) return;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    },

    _loop() {
      if (this.autorotate && this.mode === "3d") { this.theta += 0.0022; this._applyCamera(); }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this._loop);
    },

    /* ----- Decoración: ejes + grilla ----- */
    buildDecor(D, N) {
      const THREE = this.THREE;
      this._clearGroup(this.decor);
      // grilla en el plano z=0
      const divs = Math.max(4, Math.min(20, N - 1));
      const grid = new THREE.GridHelper(2 * D, divs, this._gridColor(), this._gridColor());
      grid.rotation.x = Math.PI / 2; // pasa de xz a xy
      grid.material.opacity = 0.5; grid.material.transparent = true;
      this.decor.add(grid);
      if (this.showAxes) {
        const ax = [
          [[-D, 0, 0], [D, 0, 0], 0xc47a4a],
          [[0, -D, 0], [0, D, 0], 0x2f6f6b],
          [[0, 0, this.mode === "2d" ? 0 : -D], [0, 0, this.mode === "2d" ? 0 : D], 0x7a6f9c]
        ];
        ax.forEach(([a, b, col]) => {
          const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
          const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 });
          this.decor.add(new THREE.LineSegments(g, m));
        });
      }
    },
    _gridColor() {
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      return dark ? 0x3a3428 : 0xc9bfa8;
    },

    /* ----- Campo: flechas ----- */
    buildField(funcs, opts) {
      const THREE = this.THREE;
      this._clearGroup(this.group);
      const { P, Q, R } = funcs;
      const D = opts.domain, N = opts.density, is3d = opts.mode === "3d";
      const scale = opts.scale, normalize = opts.normalize;

      const pts = [];
      const step = (2 * D) / (N - 1);
      const zs = is3d ? N : 1;
      let maxMag = 1e-9;
      for (let ix = 0; ix < N; ix++) for (let iy = 0; iy < N; iy++) for (let iz = 0; iz < zs; iz++) {
        const x = -D + ix * step, y = -D + iy * step, z = is3d ? (-D + iz * step) : 0;
        let vx = P(x, y, z), vy = Q(x, y, z), vz = is3d ? R(x, y, z) : 0;
        if (!isFinite(vx) || !isFinite(vy) || !isFinite(vz)) continue;
        const m = Math.hypot(vx, vy, vz);
        if (m < 1e-9) continue;
        if (m > maxMag) maxMag = m;
        pts.push({ x, y, z, vx, vy, vz, m });
      }

      const baseLen = step * 0.8 * scale;
      const shaftPos = [], shaftCol = [];
      const heads = [];
      for (const p of pts) {
        const t = clamp(p.m / maxMag, 0, 1);
        const col = colorAt(t);
        const dx = p.vx / p.m, dy = p.vy / p.m, dz = p.vz / p.m;
        const L = normalize ? baseLen : baseLen * (0.22 + 0.78 * t);
        const ex = p.x + dx * L, ey = p.y + dy * L, ez = p.z + dz * L;
        shaftPos.push(p.x, p.y, p.z, ex, ey, ez);
        shaftCol.push(col[0], col[1], col[2], col[0], col[1], col[2]);
        heads.push({ ex, ey, ez, dx, dy, dz, col, L });
      }

      // Shafts
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(shaftPos, 3));
      sg.setAttribute("color", new THREE.Float32BufferAttribute(shaftCol, 3));
      const sm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 });
      this.group.add(new THREE.LineSegments(sg, sm));

      // Heads (instanced cones)
      if (heads.length) {
        const headH = baseLen * 0.3, headR = baseLen * 0.1;
        const cone = new THREE.ConeGeometry(headR, headH, 10);
        const cm = new THREE.MeshBasicMaterial(); // instanceColor colorea cada punta
        const inst = new THREE.InstancedMesh(cone, cm, heads.length);
        const dummy = new THREE.Object3D();
        const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
        const color = new THREE.Color();
        heads.forEach((hd, i) => {
          dir.set(hd.dx, hd.dy, hd.dz);
          q.setFromUnitVectors(up, dir);
          dummy.position.set(hd.ex - hd.dx * headH * 0.5, hd.ey - hd.dy * headH * 0.5, hd.ez - hd.dz * headH * 0.5);
          dummy.quaternion.copy(q);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
          color.setRGB(hd.col[0], hd.col[1], hd.col[2]);
          inst.setColorAt(i, color);
        });
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.group.add(inst);
      }

      this.buildDecor(D, N);
      return { maxMag, count: pts.length };
    },

    _clearGroup(g) {
      for (let i = g.children.length - 1; i >= 0; i--) {
        const c = g.children[i];
        if (c.geometry) c.geometry.dispose();
        if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }
        g.remove(c);
      }
    },

    refreshTheme() { if (this.ok) this.buildDecor(App.state.domain, App.state.density); }
  };

  /* =============================================================
     4. App / UI
     ============================================================= */
  const App = {
    state: { mode: "3d", density: 9, scale: 1, domain: 5, normalize: true, activeInput: null },

    boot() {
      this.el = {
        panel: $("[data-panel]"),
        error: $("[data-error]"),
        pretty: $("[data-field-pretty]"),
        prettyLhs: $(".field-pretty__lhs"),
        prettyBody: $(".field-pretty__body"),
        modes: $(".panel__modes"),
        readout: $("[data-readout]"),
        maxmag: $("[data-maxmag]"),
        examplesRow: $("[data-examples]")
      };
      // aplica campo por defecto del manifest si existe
      const df = data.defaultField;
      if (df) {
        $('[data-comp="P"]').value = df.P;
        $('[data-comp="Q"]').value = df.Q;
        $('[data-comp="R"]').value = df.R || "0";
      }
      this._initScene();
      this._wireModes();
      this._wireInputs();
      this._wireKeypad();
      this._wireSliders();
      this._wireSwitches();
      this._wireActions();
      this._mountExamples();
      this.rebuild(false);
    },

    _initScene() {
      const container = $("[data-canvas]");
      Scene.init(container);
      Scene.mode = this.state.mode;
      Scene.autorotate = true;
      Scene.radius = clamp(this.state.domain * 3.0, 6, 60);
      Scene.setMode(this.state.mode, false);
    },

    getExpr() {
      return {
        P: $('[data-comp="P"]').value,
        Q: $('[data-comp="Q"]').value,
        R: this.state.mode === "3d" ? $('[data-comp="R"]').value : "0"
      };
    },

    rebuild(animate) {
      const ex = this.getExpr();
      let funcs;
      try {
        funcs = { P: compile(ex.P), Q: compile(ex.Q), R: compile(ex.R || "0") };
        this.el.error.textContent = "";
      } catch (err) {
        this.el.error.textContent = "Revisá la expresión: " + err.message;
        return;
      }
      this.updatePretty(ex);
      if (!Scene.ok) return;
      Scene.showAxes = this.state.axes !== false;
      const res = Scene.buildField(funcs, {
        mode: this.state.mode, density: this.state.density,
        scale: this.state.scale, domain: this.state.domain, normalize: this.state.normalize
      });
      if (res) {
        this.el.maxmag.textContent = res.maxMag.toFixed(2);
        this.el.readout.classList.add("is-shown");
      }
    },

    updatePretty(ex) {
      const is3d = this.state.mode === "3d";
      this.el.prettyLhs.textContent = is3d ? "F(x, y, z)" : "F(x, y)";
      const term = (val, vec) => {
        if (val == null) return "";
        const v = String(val).trim();
        if (v === "" || v === "0") return "";
        return `<b>(${escapeHtml(v)})</b><span class="field-pretty__vec">${vec}</span>`;
      };
      const parts = [term(ex.P, "î"), term(ex.Q, "ĵ")];
      if (is3d) parts.push(term(ex.R, "k̂"));
      let body = parts.filter(Boolean).join(' <span class="field-pretty__eq">+</span> ');
      this.el.prettyBody.innerHTML = body || "<b>0</b>";
    },

    _wireModes() {
      $$(".mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const m = btn.dataset.mode;
          if (m === this.state.mode) return;
          this.state.mode = m;
          $$(".mode-btn").forEach(b => b.classList.toggle("is-active", b === btn));
          this.el.modes.setAttribute("data-active", m);
          this.el.panel.setAttribute("data-mode", m);
          Scene.mode = m;
          Scene.setMode(m, true);
          this.rebuild(true);
        });
      });
      this.el.panel.setAttribute("data-mode", this.state.mode);
      this.el.modes.setAttribute("data-active", this.state.mode);
    },

    _wireInputs() {
      let deb;
      $$(".field__input").forEach(inp => {
        inp.addEventListener("focus", () => { this.state.activeInput = inp; });
        inp.addEventListener("input", () => {
          this.clearActiveExample();
          clearTimeout(deb); deb = setTimeout(() => this.rebuild(false), 240);
        });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(deb); this.rebuild(false); } });
      });
      this.state.activeInput = $('[data-comp="P"]');
    },

    _wireKeypad() {
      const kp = $("[data-keypad]");
      kp.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        let inp = this.state.activeInput;
        if (!inp || !inp.isConnected) inp = $('[data-comp="P"]');
        if (b.dataset.keyClear != null) { inp.value = ""; }
        else if (b.dataset.keyBack != null) { this._insert(inp, ""); this._backspace(inp); }
        else if (b.dataset.ins != null) { this._insert(inp, b.dataset.ins); }
        inp.focus();
        this.clearActiveExample();
        this.rebuild(false);
      });
    },
    _insert(inp, txt) {
      const s = inp.selectionStart != null ? inp.selectionStart : inp.value.length;
      const e = inp.selectionEnd != null ? inp.selectionEnd : inp.value.length;
      inp.value = inp.value.slice(0, s) + txt + inp.value.slice(e);
      const pos = s + txt.length;
      inp.setSelectionRange(pos, pos);
    },
    _backspace(inp) {
      const s = inp.selectionStart;
      if (s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(s); inp.setSelectionRange(s - 1, s - 1); }
    },

    _wireSliders() {
      const map = {
        density: (v) => { this.state.density = parseInt(v, 10); return this.state.density; },
        scale:   (v) => { this.state.scale = parseFloat(v); return this.state.scale.toFixed(1) + "×"; },
        domain:  (v) => { this.state.domain = parseInt(v, 10); Scene.radius = clamp(this.state.domain * 3.0, 6, 60); Scene.setMode(this.state.mode, false); return "±" + this.state.domain; }
      };
      $$('input[data-slider]').forEach(sl => {
        const key = sl.dataset.slider, out = $(`[data-out="${key}"]`);
        sl.addEventListener("input", () => {
          const label = map[key](sl.value);
          if (out) out.textContent = label;
          this.rebuild(false);
        });
      });
    },

    _wireSwitches() {
      $$(".switch").forEach(sw => {
        sw.addEventListener("click", () => {
          const key = sw.dataset.toggle;
          const on = !sw.classList.contains("is-on");
          sw.classList.toggle("is-on", on);
          sw.setAttribute("aria-pressed", String(on));
          if (key === "normalize") { this.state.normalize = on; this.rebuild(false); }
          else if (key === "rotate") { Scene.autorotate = on; }
          else if (key === "axes") { this.state.axes = on; Scene.showAxes = on; this.rebuild(false); }
        });
      });
      // estado inicial coherente
      this.state.normalize = $('[data-toggle="normalize"]').classList.contains("is-on");
      Scene.autorotate = $('[data-toggle="rotate"]').classList.contains("is-on");
      this.state.axes = $('[data-toggle="axes"]').classList.contains("is-on");
    },

    _wireActions() {
      const reset = $('[data-action="reset"]');
      if (reset) reset.addEventListener("click", () => Scene.resetView(true));
    },

    _mountExamples() {
      const row = this.el.examplesRow;
      if (!row || row.children.length > 0 || !data.examples) return;
      row.innerHTML = data.examples.map(ex =>
        `<button class="ex-chip" type="button" data-ex="${escapeHtml(ex.id)}" title="${escapeHtml(ex.note || "")}">${escapeHtml(ex.name)}</button>`
      ).join("");
      row.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ex]"); if (!b) return;
        const ex = data.examples.find(x => x.id === b.dataset.ex); if (!ex) return;
        this.loadExample(ex, b);
      });
    },

    loadExample(ex, chip) {
      // set mode
      if (ex.mode !== this.state.mode) {
        this.state.mode = ex.mode;
        $$(".mode-btn").forEach(b => b.classList.toggle("is-active", b.dataset.mode === ex.mode));
        this.el.modes.setAttribute("data-active", ex.mode);
        this.el.panel.setAttribute("data-mode", ex.mode);
        Scene.mode = ex.mode; Scene.setMode(ex.mode, true);
      }
      $('[data-comp="P"]').value = ex.P;
      $('[data-comp="Q"]').value = ex.Q;
      $('[data-comp="R"]').value = ex.R || "0";
      $$(".ex-chip").forEach(c => c.classList.toggle("is-active", c === chip));
      this.rebuild(true);
    },

    clearActiveExample() { $$(".ex-chip").forEach(c => c.classList.remove("is-active")); }
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function syncSwitch(key, on) {
    const sw = document.querySelector(`.switch[data-toggle="${key}"]`);
    if (sw) { sw.classList.toggle("is-on", on); sw.setAttribute("aria-pressed", String(on)); }
  }
  window.__syncSwitch = syncSwitch;

  /* =============================================================
     5. Cromo de la página (splash, nav, tema, onboarding, reveals)
     ============================================================= */
  function initSplash() {
    const sp = $("[data-splash]"); if (!sp) return;
    const hide = () => sp.classList.add("is-out");
    if (document.readyState === "complete") setTimeout(hide, 500);
    else window.addEventListener("load", () => setTimeout(hide, 350));
    setTimeout(hide, 3800); // seguridad extra
  }

  function initNav() {
    const nav = $("[data-nav]"); if (!nav) return;
    const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 12);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    // scroll suave nativo para anclas
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const id = a.getAttribute("href"); if (!id || id === "#") return;
      const el = document.querySelector(id); if (!el) return;
      e.preventDefault();
      const y = el.getBoundingClientRect().top + window.scrollY - 62;
      window.scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }

  function initTheme() {
    const btn = $("[data-theme-toggle]"), label = $("[data-theme-label]");
    if (!btn) return;
    const order = ["light", "dark", "system"];
    const names = { light: "Claro", dark: "Oscuro", system: "Sistema" };
    const apply = (pref) => {
      const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme-pref", pref);
      if (label) label.textContent = names[pref];
      try { localStorage.setItem("vcf-theme", pref); } catch (e) {}
      if (Scene.ok) Scene.refreshTheme();
    };
    let cur = document.documentElement.getAttribute("data-theme-pref") || "system";
    apply(cur);
    btn.addEventListener("click", () => { cur = order[(order.indexOf(cur) + 1) % order.length]; apply(cur); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if ((document.documentElement.getAttribute("data-theme-pref")) === "system") apply("system");
    });
  }

  function initOnboard() {
    const card = $("[data-onboard]"); if (!card) return;
    const list = $("[data-onboard-list]");
    if (list && data.onboarding) list.innerHTML = data.onboarding.map(t => `<li>${escapeHtml(t)}</li>`).join("");
    let seen = false; try { seen = localStorage.getItem("vcf-onboard") === "1"; } catch (e) {}
    if (seen) card.classList.add("is-out");
    $$("[data-onboard-close]").forEach(b => b.addEventListener("click", () => {
      card.classList.add("is-out");
      try { localStorage.setItem("vcf-onboard", "1"); } catch (e) {}
    }));
  }

  function initReveals() {
    const items = $$(".reveal");
    if (!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.04, rootMargin: "0px 0px -4% 0px" });
    items.forEach(el => io.observe(el));
    setTimeout(() => {
      $$(".reveal:not(.is-in)").forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      });
    }, 6000);
  }

  function initVersion() {
    const v = $("[data-version]"); if (v && data.version) v.textContent = data.version;
  }

  /* =============================================================
     6. Boot
     ============================================================= */
  function boot() {
    safe(initSplash, "initSplash");
    safe(initNav, "initNav");
    safe(initTheme, "initTheme");
    safe(initOnboard, "initOnboard");
    safe(initReveals, "initReveals");
    safe(initVersion, "initVersion");
    safe(() => App.boot(), "App.boot");
    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
