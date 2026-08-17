# ∇armandocf — Graficador de campos vectoriales

Web estática con dos herramientas:

1. **Campos vectoriales** en el plano (ℝ²) y en el espacio (ℝ³), al estilo GeoGebra.
2. **Isoclinas y campos direccionales** para ecuaciones diferenciales de primer orden (v1.1).

**No necesita instalar nada, ni servidores, ni cuentas.**

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
   `main.js`, `mathexpr.js`, `ode.js`, la carpeta `lib/`, la carpeta `assets/` y el
   archivo `.htaccess`.
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
- **`version`** → la versión que se muestra en el pie (`v1.1`).
- **`instagram` / `instagramUrl`** → tu usuario y link de Instagram.
- **`defaultField`** → el campo que se ve al entrar (componentes P, Q, R).
- **`examples`** → la lista de campos de ejemplo (los botones del panel).
  Cada uno tiene: `name` (lo que se lee), `mode` (`"2d"` o `"3d"`),
  `P`, `Q`, `R` (las componentes) y `note` (la explicación que aparece al pasar el mouse).
- **`odeExamples`** → los ejemplos del módulo de isoclinas. Cada uno tiene `name`,
  `form` (`"explicit"`, `"differential"` o `"implicit"`), la expresión que corresponda
  (`f`, o `M` y `N`, o `G`), opcionalmente `a` y `b` (parámetros), `view` (la ventana
  inicial), `seeds` (condiciones iniciales `[x, y]`) y `note`.
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

## 5. Cómo se usa el módulo de isoclinas (v1.1)

Está en la sección **Isoclinas** (segundo bloque de la página). Sirve para estudiar
ecuaciones diferenciales de primer orden sin resolverlas.

### Las tres formas de escribir la ecuación

| Forma | Se escribe | Ejemplo |
|---|---|---|
| **Explícita** | `y′ = f(x, y)` | `y - x^2 + 1` |
| **Diferencial** | `M dx + N dy = 0` | `M = x` , `N = y` (da circunferencias) |
| **Implícita** | `G(x, y, y′) = 0` | `x*y' + y'^2 - y` (Clairaut) |

En la implícita, la derivada se escribe `y'` (o `p`, o `dy/dx`). Se despeja
numéricamente en cada punto, así que si la ecuación tiene varias raíces vas a ver un
campo con **varias ramas** y, muchas veces, la envolvente: la solución singular.

### Qué se dibuja

- **Campo direccional**: una rayita con la pendiente de la solución en cada punto.
  El color va de verde (pendiente muy negativa) a terracota (muy positiva).
- **Isoclinas**: las curvas donde `y′` vale siempre lo mismo, con su etiqueta y un peine
  de marcas inclinadas con esa misma pendiente. La **nula** (`y′ = 0`, donde las
  soluciones tienen máximos y mínimos) y la de **tangente vertical** van resaltadas.
- **Curvas solución**: tocá el lienzo y sale la que pasa por ahí. Se integra con
  Runge–Kutta 4 por longitud de arco, hacia adelante y hacia atrás, así que atraviesa
  tangentes verticales sin cortarse.
- **Poligonal numérica**: superpone (punteado) el resultado de Euler, Heun o RK4 con el
  paso `h` que elijas. Subí el paso con Euler para ver el error acumularse.
- **Equilibrios**: si la ecuación es autónoma, marca las rectas `y = c` con `f(c) = 0`
  y dice si cada una es estable, inestable o semiestable.

### Diagnóstico automático

Debajo del lienzo, la página revisa la ecuación y te dice si es **separable**, **lineal**,
**homogénea de grado 0**, **autónoma**, si la forma diferencial es **exacta** o admite
**factor integrante** μ(x) o μ(y), y si se cumplen las hipótesis de **Picard–Lindelöf**
(existencia y unicidad). Son pruebas numéricas sobre la ventana visible: sirven para
orientarse, no son una demostración.

### Parámetros a y b

Podés usar `a` y `b` en cualquier expresión y moverlos con los deslizadores para ver
familias enteras de un saque. Por ejemplo, la logística: `a*y*(1 - y/b)`.

### Mouse y dedos

Clic = poner una condición inicial · arrastrar = desplazar · rueda o pellizco = acercar ·
doble clic = centrar. El botón **↓** del lienzo baja la figura como PNG.

---

## 6. Si subiste un cambio y NO se actualiza

Esto casi siempre es la **caché** (el navegador o el hosting siguen mostrando la versión vieja).
Soluciones, en orden:

1. En tu navegador, apretá **Ctrl + F5** (o Cmd + Shift + R en Mac) para recargar sin caché.
2. Si sigue igual, abrí `index.html` y buscá los números `?v=20260817` (aparecen al final
   de las líneas de `styles.css`, `manifest.js`, `mathexpr.js`, `main.js` y `ode.js`).
   **Cambiá esa fecha** por la de hoy en todas. Guardá y volvé a subir: eso obliga al
   navegador a bajar la versión nueva.
3. El archivo `.htaccess` ya ayuda con esto automáticamente en Hostinger; asegurate de
   haberlo subido.

---

## 7. Estructura de archivos (referencia rápida)

```
index.html      → la página
styles.css      → todos los estilos
mathexpr.js     → el lector de expresiones matemáticas (compartido)
main.js         → el motor del graficador de campos (no hace falta tocarlo)
ode.js          → el módulo de isoclinas y campos direccionales
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

## 8. Preguntas rápidas

- **¿Puedo cambiar los colores?** Sí, en `styles.css`, arriba de todo, en la sección
  “Tokens”. Los colores de las flechas están en `main.js` (buscá `STOPS`) y los del campo
  direccional en `ode.js` (buscá `SLOPE_STOPS`), pero eso ya es más avanzado.
- **¿Anda en celular?** Sí, el diseño se adapta: el lienzo arriba y los controles abajo.
- **¿Anda sin internet?** Una vez cargada, sí (todo es local salvo las fuentes de Google,
  que igual tienen respaldo del sistema).

Cualquier duda, escribime. — Hecho con calma para **∇armandocf**.
