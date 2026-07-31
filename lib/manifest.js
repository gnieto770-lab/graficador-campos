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
    version: "v1.0",
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
        q: "¿Necesito instalar algo?",
        a: "No. Funciona en cualquier navegador moderno, incluso abriendo el archivo directamente. No hay cuentas, ni descargas, ni servidores."
      }
    ]
  };
})();
