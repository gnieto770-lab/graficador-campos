/* =============================================================
   manifest.js — datos de marca y contenido (window.__BRAND__)
   Editá SOLO este archivo para cambiar textos, ejemplos y FAQ.
   Nada de lógica acá: solo datos.
   ============================================================= */
(function () {
  "use strict";

  window.__BRAND__ = {
    name: "∇armandocf",
    tagline: "Diseñado para trascender",
    version: "v1.1",
    instagram: "varmandocf",
    instagramUrl: "https://instagram.com/varmandocf",

    /* Campo por defecto que se ve al entrar (rotacional, se ve lindo girando) */
    defaultField: { mode: "3d", P: "-y", Q: "x", R: "0.4*z" },

    /* Galería de campos de ejemplo. Cada uno se carga con un click.
       mode: "2d" | "3d". Los de 2d dejan R vacío. */
    examples: [
      {
        id: "rotacional",
        name: "Rotacional",
        mode: "3d",
        P: "-y", Q: "x", R: "0.4*z",
        note: "Gira alrededor del eje z. Divergencia nula, rotor constante."
      },
      {
        id: "fuente",
        name: "Fuente radial",
        mode: "3d",
        P: "x", Q: "y", R: "z",
        note: "Todo apunta hacia afuera. Divergencia positiva: una fuente."
      },
      {
        id: "sumidero",
        name: "Sumidero",
        mode: "3d",
        P: "-x", Q: "-y", R: "-z",
        note: "Todo apunta hacia adentro. Divergencia negativa."
      },
      {
        id: "silla",
        name: "Punto silla",
        mode: "2d",
        P: "x", Q: "-y", R: "",
        note: "Se abre en x y se cierra en y. Clásico punto de ensilladura."
      },
      {
        id: "remolino",
        name: "Remolino 2D",
        mode: "2d",
        P: "-y", Q: "x", R: "",
        note: "Circulación pura en el plano. El campo del rotor visto de arriba."
      },
      {
        id: "dipolo",
        name: "Onda seno",
        mode: "2d",
        P: "sin(y)", Q: "sin(x)", R: "",
        note: "Trama ondulada: mezcla de senos que arma celdas de flujo."
      },
      {
        id: "gradiente",
        name: "Gradiente ∇f",
        mode: "3d",
        P: "2*x", Q: "2*y", R: "2*z",
        note: "Gradiente de f = x²+y²+z². Campo conservativo, rotor nulo."
      },
      {
        id: "helicoidal",
        name: "Helicoidal",
        mode: "3d",
        P: "-y", Q: "x", R: "1",
        note: "Rota en el plano y avanza en z: líneas de flujo en hélice."
      }
    ],

    /* =========================================================
       Módulo de isoclinas (v1.1). Cada ejemplo carga una EDO.
       form: "explicit" (usa f) | "differential" (usa M y N) | "implicit" (usa G)
       seeds: condiciones iniciales [x0, y0] que se dibujan al cargarlo.
       ========================================================= */
    odeExamples: [
      {
        id: "clasica",
        name: "y′ = y − x² + 1",
        form: "explicit", f: "y - x^2 + 1",
        view: { x0: -5, x1: 5 },
        seeds: [[0, 0.5], [0, -1], [0, 2]],
        note: "El ejemplo de manual. Las isoclinas son parábolas y una sola solución escapa hacia arriba."
      },
      {
        id: "lineal",
        name: "y′ = x − y",
        form: "explicit", f: "x - y",
        view: { x0: -5, x1: 5 },
        seeds: [[-4, 3], [-4, -3], [0, 0]],
        note: "Lineal de primer orden. Sus isoclinas son rectas y todas las soluciones se pegan a y = x − 1."
      },
      {
        id: "logistica",
        name: "Logística",
        form: "explicit", f: "a*y*(1 - y/b)", a: 1, b: 3,
        view: { x0: -1, x1: 9, y0: -1.2, y1: 5 },
        seeds: [[0, 0.2], [0, 4.2], [0, -0.6]],
        note: "Autónoma: y = 0 es inestable y y = b es el equilibrio estable. Movés a y b con los deslizadores."
      },
      {
        id: "explosion",
        name: "y′ = y²",
        form: "explicit", f: "y^2",
        view: { x0: -4, x1: 4 },
        seeds: [[0, 0.8], [0, -0.8]],
        note: "Explota en tiempo finito: la solución existe solo hasta x = 1/y₀ aunque f sea suavísima."
      },
      {
        id: "sin-unicidad",
        name: "y′ = √|y|",
        form: "explicit", f: "sqrt(abs(y))",
        view: { x0: -4, x1: 4 },
        seeds: [[0, 0], [-2, 0.6]],
        note: "∂f/∂y estalla en y = 0: por ahí pasa más de una solución. El contraejemplo de unicidad de siempre."
      },
      {
        id: "ricatti",
        name: "y′ = x² + y²",
        form: "explicit", f: "x^2 + y^2",
        view: { x0: -3, x1: 3 },
        seeds: [[-2.5, 0], [-2.5, -1.4]],
        note: "Ricatti sin solución elemental: las isoclinas son circunferencias y todo termina disparándose."
      },
      {
        id: "trigo",
        name: "y′ = sin(x)·cos(y)",
        form: "explicit", f: "sin(x)*cos(y)",
        view: { x0: -8, x1: 8 },
        seeds: [[0, 0.4], [0, 2.6], [-6, -1.2]],
        note: "Campo en celdas: las rectas y = π/2 + kπ son soluciones de equilibrio que nadie cruza."
      },
      {
        id: "circulos",
        name: "x dx + y dy = 0",
        form: "differential", M: "x", N: "y",
        view: { x0: -5, x1: 5 },
        seeds: [[2, 0], [3.5, 0], [1, 0]],
        note: "Exacta: F = (x² + y²)/2. Las soluciones son circunferencias, con tangente vertical sobre y = 0."
      },
      {
        id: "homogenea",
        name: "y dx − x dy = 0",
        form: "differential", M: "y", N: "-x",
        view: { x0: -5, x1: 5 },
        seeds: [[2, 1], [2, -2], [2, 3]],
        note: "No es exacta, pero (M_y − N_x)/N depende solo de x: hay factor integrante μ(x). Da rectas por el origen."
      },
      {
        id: "exacta",
        name: "2xy dx + (x²−y²) dy = 0",
        form: "differential", M: "2*x*y", N: "x^2 - y^2",
        view: { x0: -4, x1: 4 },
        seeds: [[1, 1], [2.5, 0.5], [-2, 1.5]],
        note: "Exacta de libro: F = x²y − y³/3. Las curvas dibujadas son sus curvas de nivel."
      },
      {
        id: "clairaut",
        name: "Clairaut: y = x y′ + (y′)²",
        form: "implicit", G: "x*p + p^2 - y",
        view: { x0: -5, x1: 5 },
        seeds: [[0, 1], [0, -0.5], [-3, 2]],
        note: "Cada solución es una recta, y todas envuelven la parábola y = −x²/4: la solución singular."
      },
      {
        id: "raiz",
        name: "(y′)² = 4x",
        form: "implicit", G: "p^2 - 4*x",
        view: { x0: -2, x1: 6 },
        seeds: [[1, 0]],
        note: "Campo de dos ramas: para x > 0 hay dos pendientes en cada punto y para x < 0, ninguna."
      },
      {
        id: "envolvente",
        name: "(y′)² + y² = 1",
        form: "implicit", G: "p^2 + y^2 - 1",
        view: { x0: -6, x1: 6 },
        seeds: [[0, 0], [0, 0.6]],
        note: "Senos que rebotan entre y = ±1, y esas dos rectas son las soluciones singulares que los envuelven."
      }
    ],

    /* Introducción rápida (aparece como tarjeta de bienvenida) */
    onboarding: [
      "Escribí las componentes del campo o elegí un ejemplo.",
      "Arrastrá para rotar · rueda para acercar · botón derecho para desplazar.",
      "Cambiá entre plano (ℝ²) y espacio (ℝ³) con un toque."
    ],

    /* Preguntas frecuentes */
    faqs: [
      {
        q: "¿Qué es un campo vectorial?",
        a: "Es una regla que a cada punto del plano o del espacio le asigna un vector (una flecha con dirección y magnitud). Por ejemplo, la velocidad del viento en cada punto de una habitación es un campo vectorial."
      },
      {
        q: "¿Cómo escribo el campo?",
        a: "Escribís cada componente por separado: P es la componente en x, Q en y y R en z. Podés usar x, y, z, números y funciones como sin, cos, exp, sqrt. Ejemplo: P = -y, Q = x te da un remolino."
      },
      {
        q: "¿Qué diferencia hay entre ℝ² y ℝ³?",
        a: "En ℝ² el campo vive en el plano (solo importan x e y) y lo mirás de arriba, como en una hoja. En ℝ³ el campo llena el espacio y podés rotarlo libremente. El botón ℝ²/ℝ³ salta entre ambos de forma natural, igual que en GeoGebra."
      },
      {
        q: "¿Qué operaciones puedo usar?",
        a: "Suma +, resta −, producto *, división /, potencia ^, paréntesis ( ), y funciones: sin, cos, tan, exp, ln, log, sqrt, abs, asin, acos, atan, sinh, cosh, tanh. También las constantes pi y e."
      },
      {
        q: "¿Qué significa el color de las flechas?",
        a: "El color codifica la magnitud del vector (qué tan largo sería). Los tonos fríos son magnitudes chicas y los cálidos, magnitudes grandes. Así ves de un vistazo dónde el campo es más intenso."
      },
      {
        q: "¿Qué hace el botón \"Normalizar\"?",
        a: "Pone todas las flechas del mismo largo para que se vea claramente la dirección del campo en cada punto, sin que las flechas largas tapen a las cortas. La magnitud la seguís leyendo por el color."
      },
      {
        q: "¿Qué es una isoclina?",
        a: "Es el conjunto de puntos donde la solución de una ecuación diferencial tiene siempre la misma pendiente. Si la ecuación es y' = f(x, y), la isoclina de pendiente k es la curva f(x, y) = k. Dibujando varias y poniendo en cada una un peine de rayitas con esa inclinación, el campo direccional aparece solo."
      },
      {
        q: "¿Qué formas de ecuación acepta el módulo de isoclinas?",
        a: "Tres: explícita y' = f(x, y); diferencial M(x, y)dx + N(x, y)dy = 0; e implícita G(x, y, y') = 0, que se resuelve numéricamente en cada punto y puede dar un campo con varias ramas."
      },
      {
        q: "¿Cómo se dibujan las curvas solución?",
        a: "Tocás el lienzo para poner una condición inicial. La curva se integra con Runge-Kutta 4 por longitud de arco, hacia adelante y hacia atrás, así atraviesa tangentes verticales sin cortarse. Podés superponer la poligonal de Euler, Heun o RK4 con el paso que quieras para ver el error."
      },
      {
        q: "¿Necesito instalar algo?",
        a: "No. Funciona en cualquier navegador moderno, incluso abriendo el archivo directamente. No hay cuentas, ni descargas, ni servidores."
      }
    ]
  };
})();
