(function () {
  "use strict";
  /* ∇armandocf — ode.js (v1.1)
     Módulo de isoclinas y campos direccionales para EDOs de primer orden.

     Tres formas de entrada:
       · explícita     y' = f(x, y)
       · diferencial   M(x, y) dx + N(x, y) dy = 0
       · implícita     G(x, y, y') = 0      (se resuelve y' punto a punto)

     Todo se dibuja en un <canvas> 2D. Sin dependencias externas. */

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const BRAND = window.__BRAND__ || {};

  /* Variables disponibles en las expresiones del módulo.
     p es y' ; a y b son parámetros con deslizador. */
  const VARS = ["x", "y", "p", "a", "b"];

  /* Pendiente considerada "vertical" (recta tangente sin pendiente finita) */
  const BIG = 1e7;

  /* =============================================================
     0. Utilidades numéricas y de formato
     ============================================================= */
  const fin = Number.isFinite;

  function fmt(v, d) {
    if (!fin(v)) return v > 0 ? "+∞" : (v < 0 ? "−∞" : "—");
    d = d == null ? 2 : d;
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a < 1e-4 || a >= 1e5) return v.toExponential(1).replace("e", "·10^").replace("-", "−");
    let s = v.toFixed(a < 1 ? d + 1 : d);
    s = s.replace(/\.?0+$/, "");
    return s.replace("-", "−");
  }

  // Paso "lindo" (1, 2, 5 × 10^k) para una grilla con ~n divisiones
  function niceStep(span, n) {
    const raw = span / Math.max(1, n);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / mag;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
  }

  // Percentil aproximado sobre una muestra (para acotar saltos/polos)
  function pct(arr, q, maxN) {
    const n = arr.length; if (!n) return 0;
    const stride = Math.max(1, Math.floor(n / (maxN || 1500)));
    const s = [];
    for (let i = 0; i < n; i += stride) { const v = Math.abs(arr[i]); if (fin(v)) s.push(v); }
    if (!s.length) return 0;
    s.sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  }

  /* =============================================================
     1. Paleta (leída de las variables CSS, así sigue al tema)
     ============================================================= */
  let PAL = null;
  function palette() {
    if (PAL) return PAL;
    const cs = getComputedStyle(document.documentElement);
    const v = (n, fb) => (cs.getPropertyValue(n).trim() || fb);
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    PAL = {
      dark,
      ink: v("--ink", "#2a2620"),
      inkSoft: v("--ink-soft", "#6b6459"),
      line: v("--line", "#d9d1c0"),
      accent: v("--accent", "#2f6f6b"),
      accent2: v("--accent-2", "#c47a4a"),
      surface: v("--surface", "#fbf8f1"),
      bg: v("--bg", "#f5f1e8"),
      grid: dark ? "rgba(200,186,150,0.10)" : "rgba(60,48,30,0.09)",
      gridStrong: dark ? "rgba(200,186,150,0.20)" : "rgba(60,48,30,0.18)",
      curve: dark ? "#e0996a" : "#a8443c",
      violet: dark ? "#a99ad6" : "#7a6f9c"
    };
    return PAL;
  }
  function dropPalette() { PAL = null; }

  /* Mapa divergente por pendiente: negativa (verde) → 0 (arena) → positiva (terracota) */
  const SLOPE_STOPS = [
    [0.00, [47, 111, 107]],
    [0.30, [110, 168, 158]],
    [0.50, [201, 178, 108]],
    [0.72, [196, 122, 74]],
    [1.00, [150, 62, 52]]
  ];
  function slopeColor(theta) {
    // theta ∈ (−π/2, π/2) → t ∈ (0, 1)
    let t = clamp(theta / Math.PI + 0.5, 0, 1);
    for (let i = 1; i < SLOPE_STOPS.length; i++) {
      if (t <= SLOPE_STOPS[i][0]) {
        const [t0, c0] = SLOPE_STOPS[i - 1], [t1, c1] = SLOPE_STOPS[i];
        const k = (t - t0) / (t1 - t0 || 1);
        return "rgb(" + Math.round(c0[0] + (c1[0] - c0[0]) * k) + "," +
                        Math.round(c0[1] + (c1[1] - c0[1]) * k) + "," +
                        Math.round(c0[2] + (c1[2] - c0[2]) * k) + ")";
      }
    }
    const c = SLOPE_STOPS[SLOPE_STOPS.length - 1][1];
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }

  /* Colores para la familia de curvas solución */
  const CURVE_COLORS = ["#a8443c", "#2f6f6b", "#7a6f9c", "#c47a4a", "#4b7d3f", "#9c6f2f"];
  const CURVE_COLORS_DARK = ["#e0996a", "#5bb8ac", "#a99ad6", "#d9a05b", "#8fc47a", "#d4b06a"];
  function curveColor(i) {
    const set = palette().dark ? CURVE_COLORS_DARK : CURVE_COLORS;
    return set[i % set.length];
  }

  /* =============================================================
     2. Modelo de la EDO
        Construye, a partir de las expresiones, dos objetos clave:
          iso(x, y, k) → escalar cuyo conjunto cero es la isoclina de pendiente k
          dirs(x, y)   → direcciones unitarias del campo (varias si es implícita)
     ============================================================= */
  /* y′, y' y dy/dx son la misma variable: p */
  function precleanODE(src) {
    return String(src == null ? "" : src)
      .replace(/d\s*y\s*\/\s*d\s*x/gi, "p")
      .replace(/y\s*['′’]/g, "p");
  }

  function buildModel(state) {
    const A = state.a, B = state.b;
    const m = { form: state.form, a: A, b: B, multi: false };
    // En explícita y diferencial no existe p: escribir y′ ahí es un error y debe avisar.
    const PLAIN = ["x", "y", "a", "b"];
    const c = (src, vars) => {
      const clean = precleanODE(src);
      if (!vars && /\bp\b/.test(clean)) {
        throw new Error("y′ solo se puede usar en la forma implícita");
      }
      return window.VCFMath.compile(clean, vars || PLAIN);
    };

    if (state.form === "explicit") {
      const f = c(state.src.f);
      m.f = (x, y) => f(x, y, A, B);
      m.iso = (x, y, k) => f(x, y, A, B) - k;
      m.vert = (x, y) => 1 / f(x, y, A, B);             // polos: pendiente vertical
      m.linear = { A: m.f, B: () => -1 };               // iso = f − k  (lineal en k)
      m.dirs = (x, y) => {
        const s = f(x, y, A, B);
        if (Number.isNaN(s)) return [];
        if (!fin(s) || Math.abs(s) > BIG) return [{ ux: 0, uy: 1, m: Infinity }];
        const t = Math.atan(s);
        return [{ ux: Math.cos(t), uy: Math.sin(t), m: s }];
      };

    } else if (state.form === "differential") {
      const Mf = c(state.src.M), Nf = c(state.src.N);
      m.M = (x, y) => Mf(x, y, A, B);
      m.N = (x, y) => Nf(x, y, A, B);
      m.f = (x, y) => -Mf(x, y, A, B) / Nf(x, y, A, B);
      m.iso = (x, y, k) => Mf(x, y, A, B) + k * Nf(x, y, A, B);
      m.vert = (x, y) => Nf(x, y, A, B);                // N = 0 → tangente vertical
      m.linear = { A: m.M, B: m.N };
      m.dirs = (x, y) => {
        const mv = Mf(x, y, A, B), nv = Nf(x, y, A, B);
        if (!fin(mv) || !fin(nv)) return [];
        let vx = nv, vy = -mv;
        const L = Math.hypot(vx, vy);
        if (!(L > 1e-12)) return [];                    // punto singular: M = N = 0
        vx /= L; vy /= L;
        if (vx < 0 || (vx === 0 && vy < 0)) { vx = -vx; vy = -vy; }
        return [{ ux: vx, uy: vy, m: Math.abs(nv) < 1e-12 ? Infinity : -mv / nv }];
      };

    } else {
      const G = c(state.src.G, VARS);
      m.G = (x, y, p) => G(x, y, p, A, B);
      m.iso = (x, y, k) => G(x, y, k, A, B);
      m.vert = null;
      m.linear = null;
      m.multi = true;
      m.dirs = (x, y) => implicitDirs(m.G, x, y);
      m.f = (x, y) => { const d = implicitDirs(m.G, x, y); return d.length ? d[0].m : NaN; };
    }
    return m;
  }

  /* Resuelve G(x, y, p) = 0 en p barriendo el ángulo θ = atan(p).
     Barrer θ (y no p) cubre pendientes enormes con muestreo parejo y
     encuentra todas las ramas de una implícita (ej.: Clairaut, p² = 4x). */
  const TH_LIM = Math.PI / 2 - 1e-3;
  function implicitDirs(G, x, y) {
    const out = [];
    const NS = 96;
    let tPrev = -TH_LIM, vPrev = G(x, y, Math.tan(tPrev));
    for (let i = 1; i <= NS && out.length < 4; i++) {
      const t = -TH_LIM + (2 * TH_LIM * i) / NS;
      const v = G(x, y, Math.tan(t));
      if (fin(vPrev) && fin(v)) {
        if (vPrev === 0) out.push(tPrev);
        else if ((vPrev < 0) !== (v < 0)) {
          // bisección en θ
          let lo = tPrev, hi = t, flo = vPrev;
          for (let k = 0; k < 40; k++) {
            const mid = 0.5 * (lo + hi), fm = G(x, y, Math.tan(mid));
            if (!fin(fm)) break;
            if ((flo < 0) !== (fm < 0)) hi = mid; else { lo = mid; flo = fm; }
          }
          out.push(0.5 * (lo + hi));
        }
      }
      tPrev = t; vPrev = v;
    }
    const dirs = [];
    for (const t of out) {
      if (dirs.some(d => Math.abs(d.th - t) < 1e-4)) continue;
      dirs.push({ th: t, ux: Math.cos(t), uy: Math.sin(t), m: Math.tan(t) });
    }
    return dirs;
  }

  /* =============================================================
     3. Isoclinas — marching squares sobre iso(x, y, k) = 0
     ============================================================= */
  function sampleGrid(fn, view, N, k) {
    const g = new Float64Array((N + 1) * (N + 1));
    const dx = (view.x1 - view.x0) / N, dy = (view.y1 - view.y0) / N;
    let idx = 0;
    for (let j = 0; j <= N; j++) {
      const y = view.y0 + j * dy;
      for (let i = 0; i <= N; i++) g[idx++] = fn(view.x0 + i * dx, y, k);
    }
    return g;
  }

  /* Umbral de salto: por encima de él, un cambio de signo se toma como polo
     (discontinuidad) y no como cruce por cero.
     Las diferencias en x y en y se miden por separado y se toma la mayor: si la
     función no depende de x (una autónoma, por ejemplo) la lista horizontal es
     todo ceros y usarla como escala haría desaparecer todas las isoclinas. */
  function jumpGuard(g, N) {
    const W = N + 1, dx = [], dy = [];
    for (let j = 0; j <= N; j += 2) for (let i = 1; i <= N; i += 2) {
      const a = g[j * W + i - 1], b = g[j * W + i];
      if (fin(a) && fin(b)) dx.push(Math.abs(b - a));
    }
    for (let j = 1; j <= N; j += 2) for (let i = 0; i <= N; i += 2) {
      const a = g[(j - 1) * W + i], b = g[j * W + i];
      if (fin(a) && fin(b)) dy.push(Math.abs(b - a));
    }
    const q70 = (arr) => {
      if (!arr.length) return 0;
      arr.sort((p, r) => p - r);
      return arr[Math.floor(arr.length * 0.7)] || 0;
    };
    const scale = Math.max(q70(dx), q70(dy));
    return scale > 0 ? scale * 24 : Infinity;
  }

  function marchingSquares(g, N, view, guard) {
    const segs = [];
    const dx = (view.x1 - view.x0) / N, dy = (view.y1 - view.y0) / N;
    const at = (i, j) => g[j * (N + 1) + i];
    const ip = (va, vb, a, b) => a + ((0 - va) / (vb - va)) * (b - a);

    for (let j = 0; j < N; j++) {
      const ya = view.y0 + j * dy, yb = ya + dy;
      for (let i = 0; i < N; i++) {
        const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
        if (!fin(v0) || !fin(v1) || !fin(v2) || !fin(v3)) continue;
        const mx = Math.max(v0, v1, v2, v3), mn = Math.min(v0, v1, v2, v3);
        if (mx - mn > guard) continue;                 // salto: hay un polo adentro
        if (mn > 0 || mx < 0) continue;                // sin cruce

        const xa = view.x0 + i * dx, xb = xa + dx;
        const pts = [];
        if ((v0 < 0) !== (v1 < 0)) pts.push(ip(v0, v1, xa, xb), ya);
        if ((v1 < 0) !== (v2 < 0)) pts.push(xb, ip(v1, v2, ya, yb));
        if ((v3 < 0) !== (v2 < 0)) pts.push(ip(v3, v2, xa, xb), yb);
        if ((v0 < 0) !== (v3 < 0)) pts.push(xa, ip(v0, v3, ya, yb));
        if (pts.length >= 4) {
          segs.push(pts[0], pts[1], pts[2], pts[3]);
          if (pts.length >= 8) segs.push(pts[4], pts[5], pts[6], pts[7]);
        }
      }
    }
    return segs;
  }

  /* Isoclina de pendiente k. Si iso es lineal en k (explícita y diferencial)
     se reutilizan las dos grillas base y sale gratis cada nivel. */
  function isoSegments(model, view, N, k, cache) {
    let g;
    if (model.linear) {
      if (!cache.A) {
        cache.A = sampleGrid((x, y) => model.linear.A(x, y), view, N, 0);
        cache.B = sampleGrid((x, y) => model.linear.B(x, y), view, N, 0);
        cache.guard = null;
      }
      g = new Float64Array(cache.A.length);
      for (let i = 0; i < g.length; i++) g[i] = cache.A[i] + k * cache.B[i];
    } else {
      g = sampleGrid(model.iso, view, N, k);
    }
    return marchingSquares(g, N, view, jumpGuard(g, N));
  }

  /* =============================================================
     4. Curvas solución
        Integración por longitud de arco con RK4 sobre el campo de
        direcciones. Así las soluciones atraviesan tangentes verticales
        y puntos de retorno sin romperse (imposible integrando en x).
     ============================================================= */
  function alignedDir(model, x, y, ref) {
    const ds = model.dirs(x, y);
    if (!ds.length) return null;
    let best = null, bestDot = -Infinity;
    for (const d of ds) {
      const dot = d.ux * ref[0] + d.uy * ref[1];
      if (dot > bestDot) { bestDot = dot; best = [d.ux, d.uy]; }
      if (-dot > bestDot) { bestDot = -dot; best = [-d.ux, -d.uy]; }
    }
    return bestDot > 0.02 ? best : null;   // giro de más de ~89°: cortamos
  }

  function traceArc(model, x0, y0, dir0, view, opts) {
    const spanX = view.x1 - view.x0, spanY = view.y1 - view.y0;
    const h = Math.hypot(spanX, spanY) * 0.0022;
    const mx = spanX * 0.06, my = spanY * 0.06;   // margen antes de cortar
    const pts = [x0, y0];
    let x = x0, y = y0, ref = dir0.slice();
    const MAXN = opts && opts.maxSteps ? opts.maxSteps : 3600;

    for (let n = 0; n < MAXN; n++) {
      const k1 = alignedDir(model, x, y, ref); if (!k1) break;
      const k2 = alignedDir(model, x + h * 0.5 * k1[0], y + h * 0.5 * k1[1], k1); if (!k2) break;
      const k3 = alignedDir(model, x + h * 0.5 * k2[0], y + h * 0.5 * k2[1], k2); if (!k3) break;
      const k4 = alignedDir(model, x + h * k3[0], y + h * k3[1], k3); if (!k4) break;
      const ux = (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
      const uy = (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      const nx = x + h * ux, ny = y + h * uy;
      if (!fin(nx) || !fin(ny)) break;
      x = nx; y = ny; ref = [ux, uy];
      pts.push(x, y);
      if (x < view.x0 - mx || x > view.x1 + mx || y < view.y0 - my || y > view.y1 + my) break;
      // curva cerrada: volvió al punto inicial
      if (n > 40 && Math.hypot(x - x0, y - y0) < h * 0.9) { pts.push(x0, y0); break; }
    }
    return pts;
  }

  function solutionCurve(model, x0, y0, view) {
    const d = model.dirs(x0, y0);
    if (!d.length) return null;
    const d0 = [d[0].ux, d[0].uy];
    const fwd = traceArc(model, x0, y0, d0, view);
    const bwd = traceArc(model, x0, y0, [-d0[0], -d0[1]], view);
    return { fwd, bwd, branches: d.length };
  }

  /* Poligonal numérica clásica en x (solo forma explícita): el dibujo que
     hace un método de un paso con h fijo. Sirve para ver el error. */
  function numericPolyline(f, x0, y0, h, method, view, back) {
    const pts = [x0, y0];
    let x = x0, y = y0;
    const sgn = back ? -1 : 1, H = sgn * Math.abs(h);
    const lim = back ? view.x0 : view.x1;
    const yMargin = (view.y1 - view.y0) * 3;
    for (let n = 0; n < 4000; n++) {
      if (back ? x <= lim : x >= lim) break;
      let ny;
      if (method === "euler") {
        const k1 = f(x, y); if (!fin(k1)) break;
        ny = y + H * k1;
      } else if (method === "heun") {
        const k1 = f(x, y); if (!fin(k1)) break;
        const k2 = f(x + H, y + H * k1); if (!fin(k2)) break;
        ny = y + (H / 2) * (k1 + k2);
      } else {
        const k1 = f(x, y); if (!fin(k1)) break;
        const k2 = f(x + H / 2, y + (H / 2) * k1); if (!fin(k2)) break;
        const k3 = f(x + H / 2, y + (H / 2) * k2); if (!fin(k3)) break;
        const k4 = f(x + H, y + H * k3); if (!fin(k4)) break;
        ny = y + (H / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      }
      if (!fin(ny)) break;
      x += H; y = ny;
      pts.push(x, y);
      if (y < view.y0 - yMargin || y > view.y1 + yMargin) break;
    }
    return pts;
  }

  /* =============================================================
     5. Diagnóstico automático (lo que un curso de EDO preguntaría)
     ============================================================= */
  function analyze(model, state, view) {
    const items = [];
    const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
    const sx = (view.x1 - view.x0), sy = (view.y1 - view.y0);
    const H = Math.min(sx, sy) * 1e-5;

    // Muestra de puntos "sanos" dentro de la ventana
    const sample = [];
    for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
      const x = view.x0 + (sx * (i + 0.5)) / 11, y = view.y0 + (sy * (j + 0.5)) / 11;
      sample.push([x, y]);
    }
    const fv = (x, y) => { try { return model.f(x, y); } catch (e) { return NaN; } };
    const good = sample.filter(([x, y]) => fin(fv(x, y)));
    const badCount = sample.length - good.length;

    /* --- Forma --- */
    if (state.form === "explicit") {
      items.push({ t: "Forma", v: "y′ = f(x, y)", n: "Ecuación de primer orden en forma normal." });
    } else if (state.form === "differential") {
      items.push({ t: "Forma", v: "M dx + N dy = 0", n: "Forma diferencial. La pendiente es y′ = −M/N." });
    } else {
      items.push({ t: "Forma", v: "G(x, y, y′) = 0", n: "Forma implícita: y′ se despeja numéricamente en cada punto." });
    }

    /* --- Ramas (implícita) --- */
    if (model.multi) {
      let maxB = 0, tot = 0;
      for (const [x, y] of good) { const n = model.dirs(x, y).length; maxB = Math.max(maxB, n); tot += n; }
      items.push({
        t: "Ramas de y′", v: maxB === 0 ? "sin solución real" : String(maxB),
        n: maxB > 1
          ? "En parte del dominio la ecuación define varias pendientes: el campo es multivaluado y pueden aparecer envolventes (soluciones singulares)."
          : "Una sola pendiente por punto en la región visible."
      });
    }

    /* --- Continuidad y unicidad (Picard–Lindelöf) --- */
    let maxFy = 0, singular = 0;
    for (const [x, y] of good) {
      const a = fv(x, y + H), b = fv(x, y - H);
      if (!fin(a) || !fin(b)) { singular++; continue; }
      const d = Math.abs((a - b) / (2 * H));
      if (fin(d)) maxFy = Math.max(maxFy, d);
    }
    const clean = badCount === 0 && singular === 0;
    items.push({
      t: "Existencia y unicidad",
      v: clean ? "garantizada" : "revisar puntos singulares",
      n: clean
        ? "f y ∂f/∂y se ven continuas en toda la ventana (máx |∂f/∂y| ≈ " + fmt(maxFy) +
          "): por Picard–Lindelöf pasa una única solución por cada punto."
        : "Hay " + (badCount + singular) + " de " + sample.length + " puntos de muestra donde f o ∂f/∂y no está definida. " +
          "Ahí el teorema de Picard–Lindelöf no aplica y puede fallar la unicidad."
    });

    /* --- Autonomía y equilibrios --- */
    if (state.form !== "implicit") {
      const depX = varies(fv, good, 1, 0, sx * 0.37);
      const depY = varies(fv, good, 0, 1, sy * 0.37);
      if (!depX && depY) {
        const eq = equilibria(fv, view, cx);
        items.push({
          t: "Autónoma", v: "sí · y′ = f(y)",
          n: eq.length
            ? "Equilibrios en " + eq.map(e => "y = " + fmt(e.y) + " (" + e.kind + ")").join(", ") +
              ". Las soluciones son traslaciones horizontales unas de otras."
            : "No hay equilibrios en la ventana: f(y) no se anula."
        });
        model._equil = eq;
      } else if (depX && !depY) {
        items.push({
          t: "Tipo", v: "y′ = f(x) · cuadratura directa",
          n: "La solución es y = ∫f(x)dx + C: todas las curvas son traslaciones verticales de una sola."
        });
        model._equil = [];
      } else {
        model._equil = [];
      }

      /* --- Separable / lineal / homogénea --- */
      if (isSeparable(fv, view)) {
        items.push({ t: "Separable", v: "sí", n: "f(x, y) = g(x)·h(y): se resuelve integrando dy/h(y) = g(x)dx." });
      }
      const lin = linearInY(fv, view);
      if (lin.ok) {
        items.push({
          t: "Lineal en y", v: lin.homog ? "sí, homogénea" : "sí",
          n: "Se escribe y′ + p(x)y = q(x)" + (lin.homog ? " con q ≡ 0." : ". Se resuelve con factor integrante e^∫p dx.")
        });
      }
      if (isHomog0(fv, view)) {
        items.push({ t: "Homogénea (grado 0)", v: "sí", n: "f(tx, ty) = f(x, y): la sustitución v = y/x la vuelve separable." });
      }
    } else {
      model._equil = [];
    }

    /* --- Exactitud (forma diferencial) --- */
    if (state.form === "differential") {
      let maxDiff = 0, scale = 1e-9, ok = true;
      for (const [x, y] of good) {
        const My = (model.M(x, y + H) - model.M(x, y - H)) / (2 * H);
        const Nx = (model.N(x + H, y) - model.N(x - H, y)) / (2 * H);
        if (!fin(My) || !fin(Nx)) { ok = false; continue; }
        maxDiff = Math.max(maxDiff, Math.abs(My - Nx));
        scale = Math.max(scale, Math.abs(My), Math.abs(Nx));
      }
      const exact = ok && maxDiff <= 1e-5 * Math.max(1, scale);
      let note = exact
        ? "∂M/∂y = ∂N/∂x: existe F(x, y) con dF = M dx + N dy. Las curvas dibujadas son las curvas de nivel F = C."
        : "∂M/∂y ≠ ∂N/∂x (diferencia máxima ≈ " + fmt(maxDiff) + ").";
      if (!exact) {
        const mu = integratingFactor(model, good, H);
        if (mu) note += " " + mu;
        else note += " Habría que buscar un factor integrante que dependa de x e y.";
      }
      items.push({ t: "¿Exacta?", v: exact ? "sí" : "no", n: note });
    }

    /* --- Isoclinas notables --- */
    items.push({
      t: "Isoclinas",
      v: state.iso ? state.levels.length + " niveles" : "ocultas",
      n: "Cada isoclina es el lugar donde y′ toma un valor fijo k. La nula (k = 0) marca los máximos y mínimos " +
         "de las soluciones; donde la pendiente es vertical, las soluciones tienen tangente vertical."
    });

    return items;
  }

  // ¿f cambia al mover (dx, dy) manteniendo el otro eje?
  function varies(f, pts, ex, ey, d) {
    for (const [x, y] of pts) {
      const a = f(x, y), b = f(x + ex * d, y + ey * d);
      if (fin(a) && fin(b) && Math.abs(a - b) > 1e-7 * (1 + Math.abs(a))) return true;
    }
    return false;
  }

  function equilibria(f, view, x) {
    const out = [];
    const N = 900, dy = (view.y1 - view.y0) / N;
    let yPrev = view.y0, vPrev = f(x, yPrev);
    for (let i = 1; i <= N; i++) {
      const y = view.y0 + i * dy, v = f(x, y);
      if (fin(v) && fin(vPrev) && v !== 0 && (vPrev < 0) !== (v < 0)) {
        let lo = yPrev, hi = y, flo = vPrev;
        for (let k = 0; k < 50; k++) {
          const mid = 0.5 * (lo + hi), fm = f(x, mid);
          if (!fin(fm)) break;
          if ((flo < 0) !== (fm < 0)) hi = mid; else { lo = mid; flo = fm; }
        }
        let root = 0.5 * (lo + hi);
        // La bisección deja restos tipo 6·10⁻¹⁹ donde la raíz es 0 exacto
        if (Math.abs(root) < (view.y1 - view.y0) * 1e-12) root = 0;
        const e = dy * 0.9;
        const below = f(x, root - e), above = f(x, root + e);
        let kind = "semiestable";
        if (below > 0 && above < 0) kind = "estable";
        else if (below < 0 && above > 0) kind = "inestable";
        if (out.length < 12) out.push({ y: root, kind });
      }
      yPrev = y; vPrev = v;
    }
    return out;
  }

  function isSeparable(f, v) {
    // f(x,y)·f(x0,y0) = f(x,y0)·f(x0,y) para todo par de puntos
    const x0 = v.x0 + (v.x1 - v.x0) * 0.37, y0 = v.y0 + (v.y1 - v.y0) * 0.41;
    const f00 = f(x0, y0);
    if (!fin(f00) || Math.abs(f00) < 1e-9) return false;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const x = v.x0 + ((v.x1 - v.x0) * (i + 0.5)) / 7, y = v.y0 + ((v.y1 - v.y0) * (j + 0.5)) / 7;
      const a = f(x, y), b = f(x, y0), c = f(x0, y);
      if (!fin(a) || !fin(b) || !fin(c)) return false;
      const lhs = a * f00, rhs = b * c;
      if (Math.abs(lhs - rhs) > 1e-6 * (1 + Math.abs(lhs))) return false;
    }
    return true;
  }

  function linearInY(f, v) {
    // f afín en y ⇔ segunda diferencia nula
    let homog = true;
    for (let i = 0; i < 7; i++) {
      const x = v.x0 + ((v.x1 - v.x0) * (i + 0.5)) / 7;
      const h = Math.max(1e-3, (v.y1 - v.y0) * 0.19);
      const y = (v.y0 + v.y1) / 2;
      const a = f(x, y - h), b = f(x, y), c = f(x, y + h);
      if (!fin(a) || !fin(b) || !fin(c)) return { ok: false };
      if (Math.abs(a - 2 * b + c) > 1e-6 * (1 + Math.abs(b))) return { ok: false };
      if (Math.abs(f(x, 0)) > 1e-9) homog = false;
    }
    return { ok: true, homog };
  }

  function isHomog0(f, v) {
    for (let i = 0; i < 6; i++) {
      const x = v.x0 + ((v.x1 - v.x0) * (i + 0.7)) / 6, y = v.y0 + ((v.y1 - v.y0) * (i + 0.3)) / 6;
      const t = 1.7;
      const a = f(x, y), b = f(t * x, t * y);
      if (!fin(a) || !fin(b)) return false;
      if (Math.abs(a - b) > 1e-6 * (1 + Math.abs(a))) return false;
    }
    return true;
  }

  function integratingFactor(model, pts, H) {
    const gx = [], gy = [];
    for (const [x, y] of pts) {
      const My = (model.M(x, y + H) - model.M(x, y - H)) / (2 * H);
      const Nx = (model.N(x + H, y) - model.N(x - H, y)) / (2 * H);
      const Mv = model.M(x, y), Nv = model.N(x, y);
      if (fin(My) && fin(Nx) && fin(Nv) && Math.abs(Nv) > 1e-6) gx.push([x, (My - Nx) / Nv]);
      if (fin(My) && fin(Nx) && fin(Mv) && Math.abs(Mv) > 1e-6) gy.push([y, (Nx - My) / Mv]);
    }
    const onlyOf = (arr) => {
      if (arr.length < 8) return false;
      const byKey = new Map();
      for (const [k, v] of arr) {
        const key = k.toFixed(3);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(v);
      }
      let n = 0;
      for (const vals of byKey.values()) {
        if (vals.length < 2) continue;
        n++;
        const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
        if (mx - mn > 1e-5 * (1 + Math.abs(mx))) return false;
      }
      return n >= 3;
    };
    if (onlyOf(gx)) return "Pero (M_y − N_x)/N depende solo de x: hay factor integrante μ(x) = e^∫[(M_y−N_x)/N]dx.";
    if (onlyOf(gy)) return "Pero (N_x − M_y)/M depende solo de y: hay factor integrante μ(y) = e^∫[(N_x−M_y)/M]dy.";
    return null;
  }

  /* =============================================================
     6. La aplicación del módulo
     ============================================================= */
  const Ode = {
    state: {
      form: "explicit",
      src: { f: "y - x^2 + 1", M: "2*x*y", N: "x^2 - y^2", G: "p^2 - x*p + y" },
      a: 1, b: 1,
      view: { x0: -5, x1: 5, y0: -3.5, y1: 3.5 },
      square: true,
      density: 21, arrow: 1, quality: 150,
      iso: true, isoCount: 8, isoMax: 4, levelsTxt: "", levels: [],
      isoLabels: true, isoTicks: true, isoNull: true, isoVert: true,
      field: true, normalize: true, arrows: true, colorSlope: true,
      curves: true, clickAdd: true, method: "rk4", step: 0.5, poly: false,
      grid: true, axes: true, equil: true, flow: false,
      seeds: []
    },

    model: null,
    dirty: true,
    visible: true,
    cursor: null,

    /* ---------- Arranque ---------- */
    boot() {
      this.root = $("[data-ode]");
      if (!this.root || !window.VCFMath) return;
      this.canvas = $("[data-ode-canvas]", this.root);
      this.ctx = this.canvas.getContext("2d");
      this.buf = document.createElement("canvas");
      this.bufCtx = this.buf.getContext("2d");

      this.el = {
        error: $("[data-ode-error]", this.root),
        pretty: $("[data-ode-pretty]", this.root),
        readout: $("[data-ode-readout]", this.root),
        analysis: $("[data-ode-analysis]", this.root),
        legend: $("[data-ode-legend]", this.root),
        seedList: $("[data-ode-seedlist]", this.root)
      };

      this._wireForm();
      this._wireInputs();
      this._wireKeypad();
      this._wireControls();
      this._wireCanvas();
      this._mountExamples();

      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.canvas.parentElement);
      window.addEventListener("vcf:theme", () => { dropPalette(); this.invalidate(); });

      // Solo animamos y redibujamos si la sección está a la vista
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; }, { threshold: 0.01 })
          .observe(this.root);
      }

      this.resize();
      this.recompute();
      this._frame = this._frame.bind(this);
      requestAnimationFrame(this._frame);
    },

    /* ---------- Geometría del lienzo ---------- */
    resize() {
      const box = this.canvas.parentElement.getBoundingClientRect();
      const w = Math.max(240, Math.round(box.width)), h = Math.max(200, Math.round(box.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = w; this.H = h; this.dpr = dpr;
      [this.canvas, this.buf].forEach(c => { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
      this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
      this.applyAspect();
      this.invalidate();
    },

    // Mantiene la escala 1:1 en ambos ejes (círculos redondos, ángulos reales)
    applyAspect() {
      if (!this.state.square || !this.W) return;
      const v = this.state.view;
      const cy = (v.y0 + v.y1) / 2;
      const half = ((v.x1 - v.x0) * (this.H / this.W)) / 2;
      v.y0 = cy - half; v.y1 = cy + half;
      this.syncViewInputs();
    },

    px(x) { const v = this.state.view; return ((x - v.x0) / (v.x1 - v.x0)) * this.W; },
    py(y) { const v = this.state.view; return this.H - ((y - v.y0) / (v.y1 - v.y0)) * this.H; },
    ux(px) { const v = this.state.view; return v.x0 + (px / this.W) * (v.x1 - v.x0); },
    uy(py) { const v = this.state.view; return v.y0 + ((this.H - py) / this.H) * (v.y1 - v.y0); },

    invalidate() { this.dirty = true; },

    /* ---------- Recompilar el modelo y recalcular todo ---------- */
    recompute() {
      const s = this.state;
      try {
        this.model = buildModel(s);
        // sondeo: que evalúe en un punto real de la ventana
        this.model.dirs((s.view.x0 + s.view.x1) / 2, (s.view.y0 + s.view.y1) / 2);
        this.el.error.textContent = "";
        this.root.classList.remove("is-bad");
      } catch (err) {
        this.model = null;
        this.el.error.textContent = "Revisá la expresión: " + err.message;
        this.root.classList.add("is-bad");
        this.updatePretty();
        this.invalidate();
        return;
      }
      this.computeLevels();
      this.updatePretty();
      this.updateAnalysis();
      this.updateLegend();
      this.invalidate();
    },

    computeLevels() {
      const s = this.state;
      const txt = (s.levelsTxt || "").trim();
      if (txt) {
        s.levels = txt.split(/[,;\s]+/).map(t => parseFloat(t.replace(",", "."))).filter(fin).slice(0, 24);
      } else {
        const n = s.isoCount, K = s.isoMax, out = [];
        for (let i = 0; i < n; i++) out.push(-K + (2 * K * i) / (n - 1 || 1));
        s.levels = out.map(v => Math.abs(v) < 1e-9 ? 0 : v);
      }
      // Con cantidad par el reparto automático se saltea el 0; si el usuario
      // pidió la isoclina nula, hay que agregarla igual.
      if (s.isoNull && !s.levels.some(k => Math.abs(k) < 1e-9)) s.levels.push(0);
      s.levels.sort((a, b) => a - b);
    },

    /* ---------- Ecuación "bonita" ---------- */
    updatePretty() {
      const s = this.state, esc = escapeHtml;
      let html = "";
      if (s.form === "explicit") {
        html = '<i>y′</i> <span class="ode-pretty__eq">=</span> <b>' + esc(s.src.f || "0") + "</b>";
      } else if (s.form === "differential") {
        html = '<b>' + esc(s.src.M || "0") + '</b> <i>dx</i> <span class="ode-pretty__eq">+</span> <b>' +
               esc(s.src.N || "0") + '</b> <i>dy</i> <span class="ode-pretty__eq">=</span> 0';
      } else {
        html = '<b>' + esc((s.src.G || "0").replace(/\bp\b/g, "y′")) + '</b> <span class="ode-pretty__eq">=</span> 0';
      }
      this.el.pretty.innerHTML = html;
    },

    updateAnalysis() {
      if (!this.model) return;
      let items = [];
      try { items = analyze(this.model, this.state, this.state.view); }
      catch (e) { items = [{ t: "Diagnóstico", v: "no disponible", n: "La expresión no se pudo analizar en esta ventana." }]; }
      this.el.analysis.innerHTML = items.map(it =>
        '<article class="ode-card"><p class="ode-card__t">' + escapeHtml(it.t) + '</p>' +
        '<p class="ode-card__v">' + escapeHtml(it.v) + '</p>' +
        '<p class="ode-card__n">' + escapeHtml(it.n) + "</p></article>"
      ).join("");
    },

    updateLegend() {
      const s = this.state;
      const chip = (c, t) => '<span class="ode-legend__it"><i style="background:' + c + '"></i>' + t + "</span>";
      const P = palette();
      let html = "";
      if (s.field) html += chip(s.colorSlope ? "linear-gradient(90deg,#2f6f6b,#c9b26c,#963e34)" : P.inkSoft,
                                s.colorSlope ? "pendiente −∞ → +∞" : "campo direccional");
      if (s.iso) html += chip(P.violet, "isoclinas y′ = k");
      if (s.iso && s.isoNull) html += chip(P.accent, "isoclina nula (y′ = 0)");
      if (s.iso && s.isoVert && this.model && this.model.vert) html += chip(P.accent2, "tangente vertical");
      if (s.curves && s.seeds.length) html += chip(curveColor(0), "curvas solución");
      if (s.equil && this.model && this.model._equil && this.model._equil.length) html += chip(P.accent, "equilibrios");
      this.el.legend.innerHTML = html;
    },

    /* =============================================================
       Render
       ============================================================= */
    _frame() {
      requestAnimationFrame(this._frame);
      if (!this.visible || !this.W) return;
      if (this.dirty) { this.renderStatic(); this.dirty = false; }
      if (this.state.flow) this.stepFlow();
      this.paint();
    },

    renderStatic() {
      const g = this.bufCtx, s = this.state, P = palette();
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.W, this.H);
      this.drawGrid(g, P);
      if (!this.model) return;
      if (s.iso) this.drawIsoclines(g, P);
      if (s.equil) this.drawEquilibria(g, P);
      if (s.field) this.drawField(g, P);
      if (s.curves) this.drawCurves(g, P);
    },

    paint() {
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      c.drawImage(this.buf, 0, 0);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.state.flow) this.drawFlow(c);
      if (this.cursor) this.drawCursor(c);
    },

    /* ----- Grilla y ejes ----- */
    drawGrid(g, P) {
      const s = this.state, v = s.view;
      if (s.grid) {
        const stepX = niceStep(v.x1 - v.x0, Math.max(4, Math.round(this.W / 90)));
        const stepY = niceStep(v.y1 - v.y0, Math.max(4, Math.round(this.H / 90)));
        g.lineWidth = 1;
        g.strokeStyle = P.grid;
        g.beginPath();
        for (let x = Math.ceil(v.x0 / stepX) * stepX; x <= v.x1; x += stepX) {
          const px = Math.round(this.px(x)) + 0.5;
          g.moveTo(px, 0); g.lineTo(px, this.H);
        }
        for (let y = Math.ceil(v.y0 / stepY) * stepY; y <= v.y1; y += stepY) {
          const py = Math.round(this.py(y)) + 0.5;
          g.moveTo(0, py); g.lineTo(this.W, py);
        }
        g.stroke();

        // Rótulos sobre los ejes (o pegados al borde si el eje se fue de cuadro)
        g.font = "11px " + (getComputedStyle(document.body).getPropertyValue("--mono") || "monospace");
        g.fillStyle = P.inkSoft;
        const ay = clamp(this.py(0), 12, this.H - 4);
        const ax = clamp(this.px(0), 16, this.W - 26);
        g.textAlign = "center"; g.textBaseline = "top";
        for (let x = Math.ceil(v.x0 / stepX) * stepX; x <= v.x1; x += stepX) {
          if (Math.abs(x) < stepX * 1e-6) continue;
          const px = this.px(x);
          if (px < 16 || px > this.W - 16) continue;   // se cortaría contra el borde
          g.fillText(fmt(x, 2), px, ay + 3);
        }
        g.textAlign = "right"; g.textBaseline = "middle";
        for (let y = Math.ceil(v.y0 / stepY) * stepY; y <= v.y1; y += stepY) {
          if (Math.abs(y) < stepY * 1e-6) continue;
          const py = this.py(y);
          if (py < 10 || py > this.H - 10) continue;
          g.fillText(fmt(y, 2), ax - 5, py);
        }
      }
      if (s.axes) {
        g.strokeStyle = P.gridStrong; g.lineWidth = 1.4;
        g.beginPath();
        const py0 = Math.round(this.py(0)) + 0.5, px0 = Math.round(this.px(0)) + 0.5;
        if (py0 > 0 && py0 < this.H) { g.moveTo(0, py0); g.lineTo(this.W, py0); }
        if (px0 > 0 && px0 < this.W) { g.moveTo(px0, 0); g.lineTo(px0, this.H); }
        g.stroke();
      }
    },

    /* ----- Isoclinas ----- */
    drawIsoclines(g, P) {
      const s = this.state, v = s.view, m = this.model;
      // Mientras se arrastra o hace zoom bajamos la malla: se recupera al soltar.
      const N = this.interacting ? clamp(Math.round(s.quality * 0.45), 36, 110)
                                 : clamp(Math.round(s.quality), 40, 320);
      const cache = {};
      const anchors = [];   // para repartir las etiquetas

      const strokeSegs = (segs, color, width, dash) => {
        if (!segs.length) return;
        g.save();
        g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round";
        if (dash) g.setLineDash(dash);
        g.beginPath();
        for (let i = 0; i < segs.length; i += 4) {
          g.moveTo(this.px(segs[i]), this.py(segs[i + 1]));
          g.lineTo(this.px(segs[i + 2]), this.py(segs[i + 3]));
        }
        g.stroke();
        g.restore();
      };

      // Marquitas con la pendiente k sobre la propia isoclina
      const ticks = (segs, k, color) => {
        if (!s.isoTicks || !fin(k)) return;
        const th = Math.atan(k), L = 7;
        const dx = Math.cos(th) * L, dy = -Math.sin(th) * L;
        g.save(); g.strokeStyle = color; g.lineWidth = 1.6; g.globalAlpha = 0.85;
        g.beginPath();
        const stride = Math.max(4, Math.round(segs.length / 4 / 14)) * 4;
        for (let i = 0; i < segs.length; i += stride) {
          const cx = this.px((segs[i] + segs[i + 2]) / 2), cy = this.py((segs[i + 1] + segs[i + 3]) / 2);
          g.moveTo(cx - dx, cy - dy); g.lineTo(cx + dx, cy + dy);
        }
        g.stroke(); g.restore();
      };

      s.levels.forEach((k, idx) => {
        let segs;
        try { segs = isoSegments(m, v, N, k, cache); } catch (e) { return; }
        if (!segs.length) return;
        const isNull = Math.abs(k) < 1e-12 && s.isoNull;
        const color = isNull ? P.accent : P.violet;
        strokeSegs(segs, color, isNull ? 2.1 : 1.3);
        ticks(segs, k, color);
        if (s.isoLabels) anchors.push({ segs, k, color, idx });
      });

      /* Isoclina de tangente vertical (donde y′ → ∞).
         Se contornea 1/f (o N): el umbral de salto es imprescindible acá, porque
         1/f también cambia de signo al cruzar la isoclina nula, y ese cruce es
         un salto ±∞, no un cero. */
      if (s.isoVert && m.vert) {
        let segs = null;
        try {
          const gv = sampleGrid((x, y) => m.vert(x, y), v, N, 0);
          segs = marchingSquares(gv, N, v, jumpGuard(gv, N));
        } catch (e) { segs = null; }
        if (segs && segs.length) {
          strokeSegs(segs, P.accent2, 2, [6, 4]);
          if (s.isoLabels) anchors.push({ segs, k: Infinity, color: P.accent2, idx: 99 });
        }
      }

      if (s.isoLabels) {
        const placed = [];
        anchors.forEach((a) => this.labelContour(g, a, placed));
      }
    },

    /* Coloca la etiqueta en el punto de la isoclina más lejano a las etiquetas
       ya puestas: con isoclinas que se cortan (todas las rectas por el origen,
       por ejemplo) evita el amontonamiento. */
    labelContour(g, a, placed) {
      let best = -1, bestScore = -Infinity;
      for (let k = 0; k < a.segs.length; k += 4) {
        const cx = this.px(a.segs[k]), cy = this.py(a.segs[k + 1]);
        if (cx < 40 || cx > this.W - 40 || cy < 16 || cy > this.H - 16) continue;
        let score = Infinity;
        for (const p of placed) score = Math.min(score, Math.hypot(cx - p[0], cy - p[1]));
        if (score === Infinity) score = 1e6 - Math.hypot(cx - this.W * 0.5, cy - this.H * 0.5);
        if (score > bestScore) { bestScore = score; best = k; }
      }
      if (best < 0) return;
      const x = this.px(a.segs[best]), y = this.py(a.segs[best + 1]);
      placed.push([x, y]);
      const txt = fin(a.k) ? "y′ = " + fmt(a.k) : "y′ → ∞";
      g.save();
      g.font = "600 11px " + (getComputedStyle(document.body).getPropertyValue("--mono") || "monospace");
      const w = g.measureText(txt).width + 10;
      g.globalAlpha = 0.92;
      g.fillStyle = palette().surface;
      roundRect(g, x - w / 2, y - 9, w, 18, 6); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = a.color; g.lineWidth = 1; g.stroke();
      g.fillStyle = a.color; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(txt, x, y + 1);
      g.restore();
    },

    /* ----- Equilibrios (ecuaciones autónomas) ----- */
    drawEquilibria(g, P) {
      const eq = this.model._equil || [];
      if (!eq.length) return;
      g.save();
      g.lineWidth = 2; g.setLineDash([2, 5]); g.lineCap = "round";
      for (const e of eq) {
        const y = this.py(e.y);
        if (y < 0 || y > this.H) continue;
        g.strokeStyle = e.kind === "estable" ? P.accent : (e.kind === "inestable" ? P.accent2 : P.violet);
        g.beginPath(); g.moveTo(0, y); g.lineTo(this.W, y); g.stroke();
        g.setLineDash([]);
        g.font = "600 11px " + (getComputedStyle(document.body).getPropertyValue("--mono") || "monospace");
        g.textAlign = "left"; g.textBaseline = "bottom";
        g.fillStyle = g.strokeStyle;
        g.fillText("y = " + fmt(e.y) + " · " + e.kind, 8, y - 3);
        g.setLineDash([2, 5]);
      }
      g.restore();
    },

    /* ----- Campo direccional ----- */
    drawField(g, P) {
      const s = this.state, v = s.view, m = this.model;
      const nx = clamp(s.density, 5, 61);
      const ny = Math.max(3, Math.round(nx * (this.H / this.W)));
      const cw = this.W / nx, ch = this.H / ny;
      const L = Math.min(cw, ch) * 0.42 * s.arrow;

      g.save();
      g.lineCap = "round";
      g.lineWidth = Math.max(1.1, Math.min(2.2, L * 0.16));
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
          const x = this.ux(cx), y = this.uy(cy);
          let ds;
          try { ds = m.dirs(x, y); } catch (e) { continue; }
          if (!ds.length) { this.dot(g, cx, cy, P.inkSoft); continue; }
          for (const d of ds) {
            const th = Math.atan2(d.uy, d.ux);
            let len = L;
            if (!s.normalize && fin(d.m)) len = L * clamp(0.35 + 0.65 * (Math.abs(d.m) / (1 + Math.abs(d.m))) * 1.6, 0.3, 1);
            // pantalla: y crece hacia arriba, canvas hacia abajo
            const hx = Math.cos(th) * len, hy = -Math.sin(th) * len;
            g.strokeStyle = s.colorSlope ? slopeColor(fin(d.m) ? Math.atan(d.m) : Math.sign(d.uy || 1) * 1.55)
                                         : (P.dark ? "rgba(232,224,204,.62)" : "rgba(60,52,38,.6)");
            g.beginPath();
            g.moveTo(cx - hx, cy - hy); g.lineTo(cx + hx, cy + hy);
            g.stroke();
            if (s.arrows && len > 5) {
              const a = 0.42, hl = Math.min(len * 0.55, 6);
              g.beginPath();
              g.moveTo(cx + hx, cy + hy);
              g.lineTo(cx + hx - hl * Math.cos(th - a), cy + hy + hl * Math.sin(th - a));
              g.moveTo(cx + hx, cy + hy);
              g.lineTo(cx + hx - hl * Math.cos(th + a), cy + hy + hl * Math.sin(th + a));
              g.stroke();
            }
          }
        }
      }
      g.restore();
    },

    dot(g, x, y, color) {
      g.save(); g.fillStyle = color; g.globalAlpha = 0.5;
      g.beginPath(); g.arc(x, y, 1.6, 0, 6.2832); g.fill(); g.restore();
    },

    /* ----- Curvas solución -----
       Se integran una sola vez y se guardan en coordenadas del mundo: mientras
       se arrastra o hace zoom basta reproyectarlas, que es prácticamente gratis. */
    curveKey() {
      const s = this.state, v = s.view;
      const r = (n) => Math.round(n * 100) / 100;
      return [s.form, s.src.f, s.src.M, s.src.N, s.src.G, s.a, s.b, s.method, s.step, s.poly,
              s.seeds.map(p => r(p.x) + ":" + r(p.y)).join("|"),
              r(v.x0), r(v.x1), r(v.y0), r(v.y1)].join("¦");
    },

    ensureCurves() {
      const key = this.curveKey();
      if (this._cc && (this._cc.key === key || this.interacting)) return this._cc.items;
      const s = this.state, v = s.view, m = this.model;
      const items = s.seeds.map((seed) => {
        const it = { seed };
        try { it.sol = solutionCurve(m, seed.x, seed.y, v); } catch (e) { it.sol = null; }
        if (s.poly && s.form === "explicit") {
          try {
            it.poly = [numericPolyline(m.f, seed.x, seed.y, s.step, s.method, v, false),
                       numericPolyline(m.f, seed.x, seed.y, s.step, s.method, v, true)];
          } catch (e) { it.poly = null; }
        }
        return it;
      });
      this._cc = { key, items };
      return items;
    },

    drawCurves(g, P) {
      const items = this.ensureCurves();
      items.forEach((it, i) => {
        const col = curveColor(i);
        if (it.sol) {
          g.save();
          g.strokeStyle = col; g.lineWidth = 2.4; g.lineJoin = "round"; g.lineCap = "round";
          this.strokePath(g, it.sol.fwd);
          this.strokePath(g, it.sol.bwd);
          g.restore();
        }
        // Poligonal numérica (solo explícita): se ve el error del método
        if (it.poly) {
          g.save();
          g.strokeStyle = col; g.globalAlpha = 0.85; g.lineWidth = 1.5;
          g.setLineDash([5, 4]);
          this.strokePath(g, it.poly[0]); this.strokePath(g, it.poly[1]);
          g.setLineDash([]);
          g.fillStyle = col;
          it.poly.forEach(arr => {
            for (let k = 0; k < arr.length; k += 2) {
              const X = this.px(arr[k]), Y = this.py(arr[k + 1]);
              if (X < -8 || X > this.W + 8 || Y < -8 || Y > this.H + 8) continue;
              g.beginPath(); g.arc(X, Y, 2.2, 0, 6.2832); g.fill();
            }
          });
          g.restore();
        }
        // Punto inicial
        const X = this.px(it.seed.x), Y = this.py(it.seed.y);
        g.save();
        g.fillStyle = col; g.strokeStyle = palette().surface; g.lineWidth = 2;
        g.beginPath(); g.arc(X, Y, 4.6, 0, 6.2832); g.fill(); g.stroke();
        g.restore();
      });
    },

    strokePath(g, pts) {
      if (!pts || pts.length < 4) return;
      g.beginPath();
      let pen = false;
      for (let i = 0; i < pts.length; i += 2) {
        const X = this.px(pts[i]), Y = this.py(pts[i + 1]);
        if (!fin(X) || !fin(Y) || Math.abs(X) > 1e5 || Math.abs(Y) > 1e5) { pen = false; continue; }
        if (!pen) { g.moveTo(X, Y); pen = true; } else g.lineTo(X, Y);
      }
      g.stroke();
    },

    /* ----- Animación del flujo ----- */
    stepFlow() {
      if (!this.model) return;
      const v = this.state.view;
      if (!this._flow) this._flow = [];
      const n = 200;
      const h = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) * 0.004;
      const spawn = () => ({
        x: v.x0 + Math.random() * (v.x1 - v.x0),
        y: v.y0 + Math.random() * (v.y1 - v.y0),
        life: 60 + Math.random() * 140, trail: []
      });
      while (this._flow.length < n) this._flow.push(spawn());
      for (let i = 0; i < this._flow.length; i++) {
        const p = this._flow[i];
        let ds;
        try { ds = this.model.dirs(p.x, p.y); } catch (e) { ds = []; }
        if (!ds.length || --p.life <= 0 ||
            p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) { this._flow[i] = spawn(); continue; }
        const d = ds[0];                       // orientación canónica: x creciente
        p.trail.push(p.x, p.y);
        if (p.trail.length > 14) p.trail.splice(0, 2);
        p.x += d.ux * h; p.y += d.uy * h;
      }
    },

    drawFlow(g) {
      if (!this._flow) return;
      const P = palette();
      g.save();
      g.lineCap = "round"; g.lineWidth = 1.6;
      g.strokeStyle = P.dark ? "rgba(240,232,210,.55)" : "rgba(40,34,24,.42)";
      g.beginPath();
      for (const p of this._flow) {
        const t = p.trail;
        if (t.length < 4) continue;
        g.moveTo(this.px(t[0]), this.py(t[1]));
        for (let i = 2; i < t.length; i += 2) g.lineTo(this.px(t[i]), this.py(t[i + 1]));
        g.lineTo(this.px(p.x), this.py(p.y));
      }
      g.stroke();
      g.restore();
    },

    /* ----- Cruz y lectura bajo el cursor ----- */
    drawCursor(g) {
      const P = palette(), c = this.cursor;
      g.save();
      g.strokeStyle = P.inkSoft; g.globalAlpha = 0.35; g.lineWidth = 1; g.setLineDash([3, 4]);
      g.beginPath();
      g.moveTo(c.px, 0); g.lineTo(c.px, this.H);
      g.moveTo(0, c.py); g.lineTo(this.W, c.py);
      g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      // Segmento resaltado con la pendiente exacta en el punto
      if (this.model) {
        let ds = [];
        try { ds = this.model.dirs(c.x, c.y); } catch (e) {}
        g.lineWidth = 2.6; g.lineCap = "round";
        for (const d of ds) {
          const th = Math.atan2(d.uy, d.ux), L = 26;
          g.strokeStyle = P.accent;
          g.beginPath();
          g.moveTo(c.px - Math.cos(th) * L, c.py + Math.sin(th) * L);
          g.lineTo(c.px + Math.cos(th) * L, c.py - Math.sin(th) * L);
          g.stroke();
        }
      }
      g.restore();
    },

    /* =============================================================
       Interacción con el lienzo
       ============================================================= */
    _wireCanvas() {
      const el = this.canvas;
      let down = null, moved = 0, pointers = new Map(), pinch = 0;

      const local = (e) => {
        const r = el.getBoundingClientRect();
        return { px: e.clientX - r.left, py: e.clientY - r.top };
      };

      el.addEventListener("pointerdown", (e) => {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const l = local(e);
        down = { ...l, t: Date.now(), x0: this.state.view.x0, y0: this.state.view.y0 };
        moved = 0;
      });

      el.addEventListener("pointermove", (e) => {
        const l = local(e);
        this.cursor = { px: l.px, py: l.py, x: this.ux(l.px), y: this.uy(l.py) };
        this.updateReadout();

        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) { this.pinchZoom(pointers, (d) => (pinch = d), () => pinch); return; }
        if (!down) return;
        const dx = l.px - down.px, dy = l.py - down.py;
        moved = Math.max(moved, Math.hypot(dx, dy));
        if (moved > 3) {
          const v = this.state.view;
          const sx = (v.x1 - v.x0) / this.W, sy = (v.y1 - v.y0) / this.H;
          this.panTo(down.x0 - dx * sx, down.y0 + dy * sy);
        }
      });

      const up = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = 0;
        if (down && moved <= 3 && Date.now() - down.t < 600 && this.state.clickAdd) {
          this.addSeed(this.ux(down.px), this.uy(down.py));
        }
        down = null;
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", () => { this.cursor = null; this.updateReadout(); });

      el.addEventListener("wheel", (e) => {
        e.preventDefault();
        const l = local(e);
        this.zoomAt(l.px, l.py, e.deltaY > 0 ? 1.12 : 1 / 1.12);
      }, { passive: false });

      el.addEventListener("dblclick", () => this.resetView());
    },

    /* Mientras se manipula la vista se dibuja en calidad baja y con las curvas
       cacheadas; 200 ms después de soltar se recalcula todo fino. */
    touch() {
      this.interacting = true;
      clearTimeout(this._settle);
      this._settle = setTimeout(() => {
        this.interacting = false;
        this.updateAnalysis();
        this.invalidate();
      }, 200);
    },

    panTo(x0, y0) {
      const v = this.state.view, w = v.x1 - v.x0, h = v.y1 - v.y0;
      v.x0 = x0; v.x1 = x0 + w; v.y0 = y0; v.y1 = y0 + h;
      this.syncViewInputs();
      this.touch();
      this.invalidate();
    },

    zoomAt(px, py, k) {
      const v = this.state.view;
      const x = this.ux(px), y = this.uy(py);
      v.x0 = x + (v.x0 - x) * k; v.x1 = x + (v.x1 - x) * k;
      v.y0 = y + (v.y0 - y) * k; v.y1 = y + (v.y1 - y) * k;
      this.syncViewInputs();
      this.touch();
      this.invalidate();
    },

    pinchZoom(pointers, setPrev, getPrev) {
      const p = Array.from(pointers.values());
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const prev = getPrev();
      if (prev) {
        const r = this.canvas.getBoundingClientRect();
        this.zoomAt((p[0].x + p[1].x) / 2 - r.left, (p[0].y + p[1].y) / 2 - r.top, prev / d);
      }
      setPrev(d);
    },

    resetView() {
      const v = this.state.view;
      v.x0 = -5; v.x1 = 5; v.y0 = -3.5; v.y1 = 3.5;
      this.applyAspect();
      this.syncViewInputs();
      this.updateAnalysis();
      this.invalidate();
    },

    updateReadout() {
      const r = this.el.readout;
      if (!this.cursor || !this.model) { r.innerHTML = '<span class="ode-readout__hint">Pasá el cursor por el lienzo</span>'; return; }
      const c = this.cursor;
      let ds = [];
      try { ds = this.model.dirs(c.x, c.y); } catch (e) {}
      const slopes = ds.map(d => (fin(d.m) ? fmt(d.m) : "∞"));
      const ang = ds.length ? fmt((Math.atan2(ds[0].uy, ds[0].ux) * 180) / Math.PI, 1) + "°" : "—";
      r.innerHTML =
        '<b>x</b> ' + fmt(c.x, 3) + ' <b>y</b> ' + fmt(c.y, 3) +
        ' <b>y′</b> ' + (slopes.length ? slopes.join(" | ") : "indefinida") +
        ' <b>θ</b> ' + ang;
    },

    /* =============================================================
       Semillas (condiciones iniciales)
       ============================================================= */
    addSeed(x, y) {
      if (this.state.seeds.length >= 16) this.state.seeds.shift();
      this.state.seeds.push({ x, y });
      this.syncSeeds();
    },

    seedFamily() {
      const v = this.state.view;
      const x = (v.x0 + v.x1) / 2;
      this.state.seeds = [];
      for (let i = 0; i < 9; i++) {
        const y = v.y0 + ((v.y1 - v.y0) * (i + 0.5)) / 9;
        this.state.seeds.push({ x, y });
      }
      this.syncSeeds();
    },

    syncSeeds() {
      const list = this.el.seedList;
      if (list) {
        list.innerHTML = this.state.seeds.length
          ? this.state.seeds.map((s, i) =>
              '<button class="ode-seed" type="button" data-seed="' + i + '" title="Quitar esta condición inicial">' +
              '<i style="background:' + curveColor(i) + '"></i>(' + fmt(s.x, 2) + ", " + fmt(s.y, 2) + ")</button>"
            ).join("")
          : '<span class="ode-seed__empty">Tocá el lienzo para poner una condición inicial.</span>';
      }
      this.updateLegend();
      this.invalidate();
    },

    /* =============================================================
       Cableado de la UI
       ============================================================= */
    _wireForm() {
      $$("[data-ode-form]", this.root).forEach(btn => {
        btn.addEventListener("click", () => {
          const f = btn.dataset.odeForm;
          if (f === this.state.form) return;
          this.state.form = f;
          $$("[data-ode-form]", this.root).forEach(b => b.classList.toggle("is-active", b === btn));
          this.root.setAttribute("data-form", f);
          this.clearActiveExample();
          this.recompute();
        });
      });
      this.root.setAttribute("data-form", this.state.form);
    },

    _wireInputs() {
      let deb;
      $$("[data-ode-src]", this.root).forEach(inp => {
        inp.value = this.state.src[inp.dataset.odeSrc] || "";
        inp.addEventListener("focus", () => { this.active = inp; });
        const push = () => {
          this.state.src[inp.dataset.odeSrc] = inp.value;
          this.clearActiveExample();
          this.recompute();
        };
        inp.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(push, 260); });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(deb); push(); } });
      });
      this.active = $('[data-ode-src="f"]', this.root);

      const lv = $("[data-ode-levels]", this.root);
      if (lv) lv.addEventListener("input", () => {
        this.state.levelsTxt = lv.value;
        clearTimeout(deb); deb = setTimeout(() => { this.computeLevels(); this.updateAnalysis(); this.invalidate(); }, 260);
      });

      $$("[data-ode-view]", this.root).forEach(inp => {
        inp.addEventListener("change", () => {
          const v = this.state.view, key = inp.dataset.odeView;
          const val = parseFloat(inp.value.replace(",", "."));
          if (!fin(val)) { this.syncViewInputs(); return; }
          v[key] = val;
          if (v.x1 - v.x0 < 1e-6) v.x1 = v.x0 + 1;
          if (v.y1 - v.y0 < 1e-6) v.y1 = v.y0 + 1;
          if (this.state.square && (key === "x0" || key === "x1")) this.applyAspect();
          this.syncViewInputs();
          this.updateAnalysis();
          this.invalidate();
        });
      });
    },

    syncViewInputs() {
      $$("[data-ode-view]", this.root).forEach(inp => {
        const v = this.state.view[inp.dataset.odeView];
        if (document.activeElement !== inp) inp.value = Math.round(v * 1000) / 1000;
      });
    },

    _wireKeypad() {
      const kp = $("[data-ode-keypad]", this.root);
      if (!kp) return;
      kp.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        let inp = this.active;
        if (!inp || !inp.isConnected || !inp.offsetParent) inp = $('[data-ode-src]:not([hidden])', this.root);
        const row = this.root.querySelector('[data-ode-row="' + this.state.form + '"]');
        if (row && (!inp || !row.contains(inp))) inp = $("[data-ode-src]", row);
        if (!inp) return;
        if (b.dataset.keyClear != null) inp.value = "";
        else if (b.dataset.keyBack != null) {
          const s = inp.selectionStart;
          if (s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(s); inp.setSelectionRange(s - 1, s - 1); }
        } else if (b.dataset.ins != null) {
          const s = inp.selectionStart != null ? inp.selectionStart : inp.value.length;
          const t = inp.selectionEnd != null ? inp.selectionEnd : inp.value.length;
          inp.value = inp.value.slice(0, s) + b.dataset.ins + inp.value.slice(t);
          const pos = s + b.dataset.ins.length;
          inp.setSelectionRange(pos, pos);
        }
        inp.focus();
        this.state.src[inp.dataset.odeSrc] = inp.value;
        this.clearActiveExample();
        this.recompute();
      });
    },

    _wireControls() {
      const S = this.state;

      // Interruptores
      $$("[data-ode-toggle]", this.root).forEach(sw => {
        const key = sw.dataset.odeToggle;
        sw.classList.toggle("is-on", !!S[key]);
        sw.setAttribute("aria-pressed", String(!!S[key]));
        sw.addEventListener("click", () => {
          const on = !sw.classList.contains("is-on");
          sw.classList.toggle("is-on", on);
          sw.setAttribute("aria-pressed", String(on));
          S[key] = on;
          if (key === "square") this.applyAspect();
          if (key === "iso" || key === "equil") this.updateAnalysis();
          this.updateLegend();
          this.invalidate();
        });
      });

      // Deslizadores
      const fmtOut = {
        density: v => v + "×",
        arrow: v => parseFloat(v).toFixed(1) + "×",
        quality: v => v,
        isoCount: v => v,
        isoMax: v => "±" + v,
        step: v => "h = " + parseFloat(v).toFixed(2),
        a: v => parseFloat(v).toFixed(2),
        b: v => parseFloat(v).toFixed(2)
      };
      $$("[data-ode-slider]", this.root).forEach(sl => {
        const key = sl.dataset.odeSlider;
        const out = $('[data-ode-out="' + key + '"]', this.root);
        const apply = () => {
          S[key] = parseFloat(sl.value);
          if (out) out.textContent = (fmtOut[key] || (v => v))(sl.value);
          if (key === "isoCount" || key === "isoMax") { this.computeLevels(); this.updateAnalysis(); }
          if (key === "a" || key === "b") { this.recompute(); return; }
          this.invalidate();
        };
        sl.value = S[key];
        if (out) out.textContent = (fmtOut[key] || (v => v))(sl.value);
        sl.addEventListener("input", apply);
      });

      // Método numérico
      const met = $("[data-ode-method]", this.root);
      if (met) met.addEventListener("change", () => { S.method = met.value; this.invalidate(); });

      // Condición inicial manual
      const addBtn = $("[data-ode-add]", this.root);
      if (addBtn) addBtn.addEventListener("click", () => {
        const x = parseFloat(($('[data-ode-ic="x"]', this.root).value || "").replace(",", "."));
        const y = parseFloat(($('[data-ode-ic="y"]', this.root).value || "").replace(",", "."));
        if (fin(x) && fin(y)) this.addSeed(x, y);
      });
      const fam = $("[data-ode-family]", this.root);
      if (fam) fam.addEventListener("click", () => this.seedFamily());
      const clr = $("[data-ode-clear]", this.root);
      if (clr) clr.addEventListener("click", () => { S.seeds = []; this.syncSeeds(); });

      if (this.el.seedList) this.el.seedList.addEventListener("click", (e) => {
        const b = e.target.closest("[data-seed]"); if (!b) return;
        S.seeds.splice(parseInt(b.dataset.seed, 10), 1);
        this.syncSeeds();
      });

      const rst = $("[data-ode-reset]", this.root);
      if (rst) rst.addEventListener("click", () => this.resetView());

      const zin = $("[data-ode-zoom='in']", this.root);
      if (zin) zin.addEventListener("click", () => this.zoomAt(this.W / 2, this.H / 2, 1 / 1.25));
      const zout = $("[data-ode-zoom='out']", this.root);
      if (zout) zout.addEventListener("click", () => this.zoomAt(this.W / 2, this.H / 2, 1.25));

      const png = $("[data-ode-png]", this.root);
      if (png) png.addEventListener("click", () => this.exportPNG());

      this.syncSeeds();
    },

    exportPNG() {
      // Se compone sobre un fondo opaco para que el PNG no salga transparente
      const out = document.createElement("canvas");
      out.width = this.buf.width; out.height = this.buf.height;
      const g = out.getContext("2d");
      g.fillStyle = palette().bg;
      g.fillRect(0, 0, out.width, out.height);
      g.drawImage(this.buf, 0, 0);
      out.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "isoclinas-" + this.state.form + ".png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }, "image/png");
    },

    /* ---------- Ejemplos ---------- */
    _mountExamples() {
      const row = $("[data-ode-examples]", this.root);
      const list = BRAND.odeExamples;
      if (!row || !list || row.children.length) return;
      row.innerHTML = list.map(ex =>
        '<button class="ex-chip" type="button" data-ode-ex="' + escapeHtml(ex.id) + '" title="' +
        escapeHtml(ex.note || "") + '">' + escapeHtml(ex.name) + "</button>"
      ).join("");
      row.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ode-ex]"); if (!b) return;
        const ex = list.find(x => x.id === b.dataset.odeEx); if (!ex) return;
        this.loadExample(ex, b);
      });
    },

    loadExample(ex, chip) {
      const S = this.state;
      S.form = ex.form || "explicit";
      if (ex.f != null) S.src.f = ex.f;
      if (ex.M != null) S.src.M = ex.M;
      if (ex.N != null) S.src.N = ex.N;
      if (ex.G != null) S.src.G = ex.G;
      if (ex.a != null) { S.a = ex.a; const sl = $('[data-ode-slider="a"]', this.root); if (sl) { sl.value = ex.a; const o = $('[data-ode-out="a"]', this.root); if (o) o.textContent = (+ex.a).toFixed(2); } }
      if (ex.b != null) { S.b = ex.b; const sl = $('[data-ode-slider="b"]', this.root); if (sl) { sl.value = ex.b; const o = $('[data-ode-out="b"]', this.root); if (o) o.textContent = (+ex.b).toFixed(2); } }
      if (ex.view) { Object.assign(S.view, ex.view); this.applyAspect(); }
      S.seeds = (ex.seeds || []).map(s => ({ x: s[0], y: s[1] }));

      $$("[data-ode-form]", this.root).forEach(b => b.classList.toggle("is-active", b.dataset.odeForm === S.form));
      this.root.setAttribute("data-form", S.form);
      $$("[data-ode-src]", this.root).forEach(inp => { inp.value = S.src[inp.dataset.odeSrc] || ""; });
      $$("[data-ode-ex]", this.root).forEach(c => c.classList.toggle("is-active", c === chip));
      this.syncViewInputs();
      this.syncSeeds();
      this.recompute();
    },

    clearActiveExample() { $$("[data-ode-ex]", this.root).forEach(c => c.classList.remove("is-active")); }
  };

  /* ---------- Utilidades sueltas ---------- */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  /* ---------- Boot ---------- */
  function boot() {
    try { Ode.boot(); } catch (e) { console.warn("[ode]", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Núcleo numérico expuesto: sirve para depurar desde la consola y para tests.
  Ode.core = {
    buildModel, isoSegments, marchingSquares, sampleGrid, jumpGuard,
    solutionCurve, traceArc, numericPolyline, implicitDirs, analyze,
    equilibria, precleanODE
  };
  window.__ODE__ = Ode;
})();
