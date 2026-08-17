/* =============================================================
   mathexpr.js — Expresiones matemáticas → función numérica
   Tokenizer + Shunting-yard → RPN → intérprete de pila.
   Sin eval, sin new Function. Compartido por main.js y ode.js.

   Uso:
     const f = VCFMath.compile("x^2 - y", ["x", "y"]);
     f(2, 1) // → 3
   ============================================================= */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (root) root.VCFMath = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- Catálogo de funciones (con aridad) ---------- */
  const FUNCS = {};
  const put = (arity, table) => {
    for (const k in table) FUNCS[k] = { arity, fn: table[k] };
  };

  put(1, {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    exp: Math.exp, ln: Math.log, log: Math.log,
    log10: Math.log10, log2: Math.log2,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    sign: Math.sign, floor: Math.floor, ceil: Math.ceil,
    round: Math.round, trunc: Math.trunc,
    sec: (t) => 1 / Math.cos(t),
    csc: (t) => 1 / Math.sin(t),
    cot: (t) => 1 / Math.tan(t),
    step: (t) => (t >= 0 ? 1 : 0)
  });

  put(2, {
    atan2: Math.atan2, min: Math.min, max: Math.max,
    pow: Math.pow, hypot: Math.hypot,
    mod: (a, b) => ((a % b) + b) % b,
    logb: (a, b) => Math.log(a) / Math.log(b)
  });

  const CONSTS = {
    pi: Math.PI, e: Math.E, tau: 2 * Math.PI,
    phi: (1 + Math.sqrt(5)) / 2
  };

  /* ---------- Operadores ----------
     La precedencia del unario (3.5) queda entre * y ^ para que
     -x^2 sea -(x²) y 2^-1 sea 0.5 (los prefijos no desalojan pila). */
  const UNARY_PREC = 3.5;
  const OPS = {
    "+": { prec: 2, assoc: "L", fn: (a, b) => a + b },
    "-": { prec: 2, assoc: "L", fn: (a, b) => a - b },
    "*": { prec: 3, assoc: "L", fn: (a, b) => a * b },
    "/": { prec: 3, assoc: "L", fn: (a, b) => a / b },
    "^": { prec: 4, assoc: "R", fn: (a, b) => Math.pow(a, b) }
  };

  /* ---------- Limpieza previa: símbolos lindos → ASCII ---------- */
  function preclean(str) {
    return String(str == null ? "" : str)
      .replace(/[−–—]/g, "-")   // − – —
      .replace(/[×·⋅]/g, "*")   // × · ⋅
      .replace(/÷/g, "/")                 // ÷
      .replace(/π/g, "pi")                // π
      .replace(/√/g, "sqrt")              // √
      .replace(/²/g, "^2")                // ²
      .replace(/³/g, "^3")                // ³
      .replace(/[\[{]/g, "(")
      .replace(/[\]}]/g, ")")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  const isDigit = (c) => c >= "0" && c <= "9";
  const isAlpha = (c) => (c >= "a" && c <= "z") || c === "_";
  const isAlnum = (c) => isAlpha(c) || isDigit(c);

  /* ---------- Tokenizer ---------- */
  function tokenize(str, vars) {
    const s = preclean(str), t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];

      // número (con notación científica: 1e-3)
      if (isDigit(c) || (c === "." && isDigit(s[i + 1]))) {
        let num = "";
        while (i < s.length && (isDigit(s[i]) || s[i] === ".")) num += s[i++];
        if (s[i] === "e") {
          const sign = s[i + 1] === "+" || s[i + 1] === "-" ? 1 : 0;
          if (isDigit(s[i + 1 + sign])) {
            num += s[i++];                       // e
            if (sign) num += s[i++];             // + o -
            while (i < s.length && isDigit(s[i])) num += s[i++];
          }
        }
        const v = parseFloat(num);
        if (!isFinite(v)) throw new Error("número inválido: " + num);
        t.push({ type: "num", value: v });
        continue;
      }

      /* Identificador. Se lee la corrida alfanumérica completa y después se
         parte en trozos conocidos, prefijo más largo primero: así "xy" son dos
         variables, "xsin(y)" es x·sin(y) y "pi" sigue siendo π (no p·i). */
      if (isAlpha(c)) {
        let word = "";
        while (i < s.length && isAlnum(s[i])) word += s[i++];
        const nextCh = s[i];
        let rest = word;
        while (rest.length) {
          let hit = null;
          for (let L = rest.length; L >= 1; L--) {
            const cand = rest.slice(0, L), last = L === rest.length;
            const vi = vars.indexOf(cand);
            if (FUNCS[cand] && last && nextCh === "(") hit = { type: "func", value: cand };
            else if (vi >= 0) hit = { type: "var", index: vi, value: cand };
            else if (CONSTS[cand] != null) hit = { type: "num", value: CONSTS[cand] };
            if (hit) { rest = rest.slice(L); break; }
          }
          if (!hit) {
            for (let L = rest.length; L >= 1; L--) {
              if (FUNCS[rest.slice(0, L)]) throw new Error("escribí " + rest.slice(0, L) + "(…) con paréntesis");
            }
            throw new Error("no reconozco «" + rest + "»");
          }
          t.push(hit);
        }
        continue;
      }

      if (c in OPS) { t.push({ type: "op", value: c }); i++; continue; }
      if (c === "(") { t.push({ type: "lp" }); i++; continue; }
      if (c === ")") { t.push({ type: "rp" }); i++; continue; }
      if (c === ",") { t.push({ type: "comma" }); i++; continue; }
      if (c === "=") throw new Error("no escribas «=»: solo el lado derecho");
      throw new Error("símbolo inesperado: " + c);
    }
    return t;
  }

  /* ---------- Multiplicación implícita + signos unarios ----------
     2x → 2*x · xy → x*y · )( → )*( · x sin(y) → x*sin(y)
     -x → uop(-) x  ·  +x → x                                     */
  function normalize(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      const prev = out[out.length - 1];
      const atStart = !prev || prev.type === "op" || prev.type === "uop" ||
                      prev.type === "lp" || prev.type === "comma";

      if (tk.type === "op" && (tk.value === "-" || tk.value === "+")) {
        if (atStart) { if (tk.value === "-") out.push({ type: "uop", value: "-" }); }
        else out.push(tk);
        continue;
      }

      if (prev) {
        const prevEnds = prev.type === "num" || prev.type === "var" || prev.type === "rp";
        const curStarts = tk.type === "num" || tk.type === "var" ||
                          tk.type === "func" || tk.type === "lp";
        if (prevEnds && curStarts) out.push({ type: "op", value: "*" });
      }
      out.push(tk);
    }
    return out;
  }

  /* ---------- Shunting-yard → RPN ---------- */
  function toRPN(tokens) {
    const out = [], stack = [];
    const precOf = (tk) => (tk.type === "uop" ? UNARY_PREC : OPS[tk.value].prec);

    for (const tk of tokens) {
      if (tk.type === "num" || tk.type === "var") { out.push(tk); continue; }
      if (tk.type === "func") { stack.push(tk); continue; }

      if (tk.type === "op") {
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type !== "op" && top.type !== "uop") break;
          const pt = precOf(top), pc = OPS[tk.value].prec;
          if (pt > pc || (pt === pc && OPS[tk.value].assoc === "L")) out.push(stack.pop());
          else break;
        }
        stack.push(tk);
        continue;
      }

      // prefijo: su operando viene después, nunca desaloja
      if (tk.type === "uop") { stack.push(tk); continue; }

      if (tk.type === "lp") { stack.push(tk); continue; }

      if (tk.type === "comma") {
        while (stack.length && stack[stack.length - 1].type !== "lp") out.push(stack.pop());
        if (!stack.length) throw new Error("coma fuera de una función");
        continue;
      }

      if (tk.type === "rp") {
        while (stack.length && stack[stack.length - 1].type !== "lp") out.push(stack.pop());
        if (!stack.length) throw new Error("paréntesis sin abrir");
        stack.pop();
        if (stack.length && stack[stack.length - 1].type === "func") out.push(stack.pop());
        continue;
      }
    }
    while (stack.length) {
      const s = stack.pop();
      if (s.type === "lp") throw new Error("paréntesis sin cerrar");
      out.push(s);
    }
    return out;
  }

  /* ---------- Validación de aridad + profundidad de pila ---------- */
  function checkRPN(rpn) {
    let depth = 0, max = 0;
    for (const tk of rpn) {
      let need = 0, gives = 1;
      if (tk.type === "num" || tk.type === "var") need = 0;
      else if (tk.type === "uop") need = 1;
      else if (tk.type === "op") need = 2;
      else if (tk.type === "func") need = FUNCS[tk.value].arity;
      if (depth < need) throw new Error("expresión incompleta");
      depth = depth - need + gives;
      if (depth > max) max = depth;
    }
    if (depth !== 1) throw new Error("expresión incompleta");
    return max;
  }

  /* ---------- Compilación ---------- */
  const DEFAULT_VARS = ["x", "y", "z"];

  function compile(expr, vars) {
    vars = vars || DEFAULT_VARS;
    const src = String(expr == null ? "" : expr);
    if (!src.trim()) {
      const zero = () => 0;
      zero.source = ""; zero.vars = vars; zero.isZero = true;
      return zero;
    }
    const rpn = toRPN(normalize(tokenize(src, vars)));
    const depth = checkRPN(rpn);
    const st = new Array(depth);
    const n = rpn.length;

    const fn = function () {
      let sp = 0;
      for (let i = 0; i < n; i++) {
        const tk = rpn[i];
        switch (tk.type) {
          case "num": st[sp++] = tk.value; break;
          case "var": st[sp++] = arguments[tk.index]; break;
          case "uop": st[sp - 1] = -st[sp - 1]; break;
          case "op": { const b = st[--sp]; st[sp - 1] = OPS[tk.value].fn(st[sp - 1], b); break; }
          default: {
            const f = FUNCS[tk.value];
            if (f.arity === 1) st[sp - 1] = f.fn(st[sp - 1]);
            else { const b = st[--sp]; st[sp - 1] = f.fn(st[sp - 1], b); }
          }
        }
      }
      return st[0];
    };

    fn.source = src;
    fn.vars = vars;
    // Sondeo: dispara errores estructurales antes de devolverla.
    fn.apply(null, vars.map((_, i) => 0.7 + i * 0.13));
    return fn;
  }

  /* ---------- ¿La expresión depende de una variable? ----------
     Prueba numérica: mueve una sola variable y mira si cambia. */
  function dependsOn(fn, index, samples) {
    const pts = samples || [[0.7, 1.3], [-1.1, 0.4], [2.3, -1.7], [0.2, 2.1]];
    const args = new Array(fn.vars.length).fill(0);
    for (const p of pts) {
      for (let i = 0; i < args.length; i++) args[i] = p[i % p.length];
      args[index] = 0.31;
      const a = fn.apply(null, args);
      args[index] = 1.77;
      const b = fn.apply(null, args);
      if (isFinite(a) && isFinite(b) && Math.abs(a - b) > 1e-9 * (1 + Math.abs(a))) return true;
      if (isFinite(a) !== isFinite(b)) return true;
    }
    return false;
  }

  return { compile, tokenize, normalize, toRPN, dependsOn, FUNCS, CONSTS, OPS, preclean };
});
