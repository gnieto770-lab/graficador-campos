# ∇armandocf — Graficador de campos vectoriales

Web estática para graficar campos vectoriales en el plano (ℝ²) y en el espacio (ℝ³),
al estilo GeoGebra. **No necesita instalar nada, ni servidores, ni cuentas.**

---

## 1. Cómo abrirla en tu computadora

- **La forma más simple:** doble clic en `index.html`. Se abre en tu navegador y funciona.
- **La forma recomendada** (para que TODO ande al 100%, incluidas todas las animaciones):
  abrila desde una dirección `http://…` en vez de `file://`. Cuando la subas a tu
  hosting eso pasa solo. En tu PC, si querés probar “como en internet”, podés usar
  cualquier servidor local; pero para el uso normal, el doble clic alcanza.

> Recomendado: Google Chrome, Edge o Firefox actualizados.

---

## 2. Cómo subirla a Hostinger (o cualquier hosting)

1. Entrá al **Administrador de archivos** de Hostinger (hPanel → Archivos).
2. Abrí la carpeta `public_html`.
3. **Arrastrá TODO el contenido de esta carpeta ahí adentro**: `index.html`, `styles.css`,
   `main.js`, la carpeta `lib/`, la carpeta `assets/` y el archivo `.htaccess`.
   - Ojo: subí el **contenido** de la carpeta, no la carpeta en sí.
   - El archivo `.htaccess` es importante (maneja la caché). Si no lo ves, activá
     “mostrar archivos ocultos” en el administrador.
4. Entrá a tu dominio y listo.

Funciona igual en Netlify, Vercel, GitHub Pages o cualquier hosting estático:
arrastrás la carpeta y ya está.

---

## 3. Qué archivo tocar para cambiar cosas

**Casi todo lo editable está en un solo archivo:** `lib/manifest.js`.
Abrilo con el Bloc de notas (o cualquier editor de texto) y vas a ver todo comentado.

Ahí podés cambiar:

- **`name`** → el nombre de marca (`∇armandocf`).
- **`tagline`** → el eslogan (`Diseñado para trascender`).
- **`version`** → la versión que se muestra en el pie (`v1.0`).
- **`instagram` / `instagramUrl`** → tu usuario y link de Instagram.
- **`defaultField`** → el campo que se ve al entrar (componentes P, Q, R).
- **`examples`** → la lista de campos de ejemplo (los botones del panel).
  Cada uno tiene: `name` (lo que se lee), `mode` (`"2d"` o `"3d"`),
  `P`, `Q`, `R` (las componentes) y `note` (la explicación que aparece al pasar el mouse).
- **`onboarding`** → las 3 frases de la tarjeta de bienvenida.
- **`faqs`** → las preguntas frecuentes (esto **también** está escrito en `index.html`;
  si cambiás una pregunta, cambiala en los dos lados para que se vea siempre).

Después de guardar, recargá la página. Si no ves el cambio, mirá el punto 5.

---

## 4. Cómo se usa el graficador (para tus alumnos / vos)

- Botón **ℝ² · plano** / **ℝ³ · espacio**: salta entre trabajar en el plano o en el espacio.
- **P, Q, R**: las componentes del campo (en x, y, z). Se escriben con `x`, `y`, `z`,
  números y funciones: `sin`, `cos`, `tan`, `exp`, `ln`, `sqrt`, `abs`, `pi`, etc.
  Ejemplos: `-y` , `x*y` , `sin(x)+cos(z)` , `2*x^2`.
- **Teclado** de botones: inserta funciones y símbolos donde tengas el cursor.
- **Densidad**: cuántas flechas se dibujan.
- **Escala de flechas**: qué tan largas se ven.
- **Dominio**: hasta dónde llega la grilla (±5, ±8, etc.).
- **Normalizar**: pone todas las flechas del mismo largo (la magnitud se lee por el color).
- **Girar**: rotación automática (solo en ℝ³).
- **Ejes**: muestra/oculta los ejes de colores.
- **Centrar vista**: vuelve la cámara a la posición inicial.
- **Mouse**: arrastrar = rotar · rueda = acercar · botón derecho = desplazar.
  En celular: un dedo = rotar · dos dedos = zoom.

---

## 5. Si subiste un cambio y NO se actualiza

Esto casi siempre es la **caché** (el navegador o el hosting siguen mostrando la versión vieja).
Soluciones, en orden:

1. En tu navegador, apretá **Ctrl + F5** (o Cmd + Shift + R en Mac) para recargar sin caché.
2. Si sigue igual, abrí `index.html` y buscá los números `?v=20260719` (aparecen
   al final de las líneas de `styles.css` y `main.js`). **Cambiá esa fecha** por la de hoy,
   por ejemplo `?v=20260720`, en las dos líneas. Guardá y volvé a subir. Eso obliga al
   navegador a bajar la versión nueva.
3. El archivo `.htaccess` ya ayuda con esto automáticamente en Hostinger; asegurate de
   haberlo subido.

---

## 6. Estructura de archivos (referencia rápida)

```
index.html      → la página
styles.css      → todos los estilos
main.js         → el motor del graficador (no hace falta tocarlo)
.htaccess       → configuración de caché para Hostinger (subirlo sí o sí)
lib/
  manifest.js   → ⭐ acá editás marca, ejemplos, FAQ, Instagram
  three.min.js  → librería 3D (WebGL)
  gsap.min.js   → animaciones
  ScrollTrigger.min.js
  lenis.min.js  → (no se usa, se puede dejar)
assets/
  credits.json  → (esta web no usa fotos de stock)
```

---

## 7. Preguntas rápidas

- **¿Puedo cambiar los colores?** Sí, en `styles.css`, arriba de todo, en la sección
  “Tokens”. Los colores de las flechas están en `main.js` (buscá `STOPS`), pero eso ya es
  más avanzado.
- **¿Anda en celular?** Sí, el diseño se adapta: el lienzo arriba y los controles abajo.
- **¿Anda sin internet?** Una vez cargada, sí (todo es local salvo las fuentes de Google,
  que igual tienen respaldo del sistema).

Cualquier duda, escribime. — Hecho con calma para **∇armandocf**.
