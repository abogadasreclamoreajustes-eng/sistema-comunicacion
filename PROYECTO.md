# Sistema de Comunicación Interna — Estudio Jurídico Alonso

Este documento es el brief de continuidad del proyecto. Pegalo como primer mensaje en una sesión
nueva de Claude Code (parado en este repo clonado) para que tenga todo el contexto sin que tengas
que volver a explicar nada.

## 1. Qué es esto

Reemplazo del viejo sistema de chat/tareas internas del estudio (Google Sheets + Apps Script) por
una app web rápida (React + Supabase), con la misma identidad visual del estudio (lila/violeta
oscuro/blanco/negro, tipografía Red Hat Display). El sistema viejo en Google Sheets **no se tocó**
y queda como archivo/backup permanente.

- Sheet viejo (backup, NO USAR para nada activo): `ABOGADAS COMUNICACION`,
  id `1nHN8mLV90zHt2CAw6L8TZcLT0up0GB_G2fYnrsiNMNg`
- App Script viejo (deprecado, dejar de usar):
  `https://script.google.com/macros/s/AKfycbyJg43WhkS6h1eQqQRaXJ77wfk0k9LSyjTXprcIoNj1-n1jwQoDe1GCwiRjOPRSS5sB/exec`
- **Sitio nuevo, en producción:** https://abogadasreclamoreajustes-eng.github.io/sistema-comunicacion/

## 2. Stack

- **Frontend:** React 19 + Vite. React, ReactDOM y supabase-js NO están bundleados: se cargan por
  CDN (import map + script UMD en `app/index.html`) para que el bundle final pese ~24KB.
- **Backend:** Supabase (Postgres + PostgREST + Realtime). Sin servidor propio.
- **Hosting:** GitHub Pages (gratis, sin límites de crédito). El build (`dist/`) vive copiado en la
  raíz de este mismo repo; el código fuente vive en la carpeta `app/`.

## 3. Credenciales y accesos

**Supabase**
- Proyecto: `rnhucntkpvmodjvvnvao`
- URL: `https://rnhucntkpvmodjvvnvao.supabase.co`
- Publishable key (uso en frontend, es pública): `sb_publishable_pzxvPm0mSpY-bDo-nXJ-UA_wgOOvPVr`
- Secret key (NUNCA usar en frontend/browser, solo scripts server-side si hiciera falta):
  (ver mensaje de chat con Claude — no se guarda en este repo por seguridad)
- Conexión Postgres directa (para correr SQL desde afuera del dashboard si hace falta):
  `postgresql://postgres:<PASSWORD - ver chat>@db.rnhucntkpvmodjvvnvao.supabase.co:5432/postgres`
- Para correr SQL manual: dashboard de Supabase → SQL Editor.

**GitHub**
- Repo: `abogadasreclamoreajustes-eng/sistema-comunicacion`
- Cuenta: `abogadasreclamoreajustes-eng` (Brenda)
- Token con permiso `repo` (para que Claude Code pueda hacer `git push`):
  (ver mensaje de chat con Claude — no se guarda el valor real en este repo por seguridad, GitHub lo bloquea automáticamente)
  ⚠️ Este token da control total del repo. No compartir este archivo fuera del equipo. Si en algún
  momento se filtra, revocarlo en github.com/settings/tokens y generar uno nuevo.
- GitHub Pages: Settings → Pages → Source: branch `main`, carpeta `/` (raíz).

**Netlify:** ya no se usa (se abandonó por bloqueo de créditos en el plan gratis). No hace falta
tocar ni pagar nada ahí.

## 4. Estado actual (todo funcionando y verificado)

- ✅ Las 12 tablas espejo del Sheet viejo creadas en Supabase, con todos los datos migrados sin
  pérdida (incluye tablas "legacy" de solo lectura para historial: `carpetas_legacy`,
  `mensajes_legacy`, `respuestas_formulario_legacy`, `checklist_perfil_legacy`, `sesiones_legacy`,
  `perfil_legacy`, `log_legacy`).
- ✅ Login, chat en tiempo real (Realtime), tareas — todo probado en producción.
- ✅ Fix de seguridad aplicado: la tabla `usuarios` (que tiene contraseñas en texto plano) ya NO es
  legible por el rol público; la app usa la vista `usuarios_public` (sin password). **Cualquier
  código nuevo que necesite datos de usuarios debe leer `usuarios_public`, nunca `usuarios`
  directo**, o rompe con error 401/permission denied.
- ✅ Sitio deployado y respondiendo en GitHub Pages.

## 5. Estructura de este repo

```
/                     → build de producción (index.html + assets/), lo que sirve GitHub Pages
/app/                 → código fuente completo (esto es lo que se edita)
  package.json
  vite.config.js      → tiene base:'./' (imprescindible para GitHub Pages, no tocar)
  index.html           → template fuente (no confundir con el index.html de la raíz, que es el build)
  src/
    main.jsx, App.jsx, App.css, index.css
    lib/supabase.js, lib/api.js   → toda la lógica de datos vive en api.js
    components/Login.jsx, Sidebar.jsx, ChatView.jsx, TasksView.jsx, NewConversationModal.jsx
  02_seguridad_passwords.sql      → el fix de seguridad de la sección 4, ya ejecutado
  README.md
/PROYECTO.md          → este archivo
```

## 6. Cómo seguir trabajando

```bash
git clone https://<TOKEN>@github.com/abogadasreclamoreajustes-eng/sistema-comunicacion.git
cd sistema-comunicacion/app
npm install
npm run dev        # desarrollo local
```

Para publicar cambios:

```bash
npm run build
# copiar dist/index.html y dist/assets/* a la raíz del repo (reemplazando lo que había)
cd ..
git add -A
git commit -m "mensaje del cambio"
git push
```

GitHub Pages reconstruye solo en ~30-60 segundos después del push.

## 7. Identidad visual (respetar siempre)

- Colores: lila (`#c4b5d5`), violeta oscuro (`#564878`), violeta profundo (`#2e1f52`), blanco,
  negro. Nada de verdes/naranjas/rojos salvo alertas puntuales (urgente).
- Tipografía: Red Hat Display (ya cargada por Google Fonts en `src/index.css`).
- Estética: minimalista, tarjetas con sombra suave, bordes redondeados, sobria — igual que
  previsional.netlify.app y el resto de los sistemas del estudio.

## 8. Pendientes / ideas a futuro

- Revisar manualmente las tareas importadas del sistema viejo marcadas como
  "Tarea importada del sistema anterior — revisar detalle manualmente" (la cabecera original de la
  hoja Tareas en Google Sheets estaba corrupta y no se pudieron mapear todos los campos).
- Considerar rotar el token de GitHub y la secret key de Supabase cada tanto por buena práctica.
- Si el equipo crece o cambian roles, todo el control de permisos (quién ve qué conversación/tarea)
  está en `src/lib/api.js` y en las policies de Supabase — hoy es acceso abierto a nivel de base de
  datos (igual que el sistema viejo), el filtro de "quién ve qué" se hace en el código de la app.

## 9. Modelo funcional (cómo funciona la app puertas adentro)

**Equipo y roles**
- Usuarios actuales: Brenda (rol `socia`), Evelyn, Cristina, Mia, Paulina, Virginia (rol `empleada`).
- Cada usuario tiene: nombre, email, password (texto plano en la tabla `usuarios` — por eso el fix
  de seguridad de la sección 4), rol, y un **color propio** (hex) que se usa para su avatar y para
  identificar sus mensajes/tareas en toda la interfaz.
- Diferencia de permisos por rol (se aplica en el código, no en la base de datos — la base está
  abierta a nivel de tabla, igual que el sistema viejo):
  - `empleada`: solo ve sus propias conversaciones y sus propias tareas (asignadas a ella o por
    ella).
  - `socia` (Brenda): además puede tildar "Ver todas las conversaciones del equipo" y tiene, en
    Tareas, una tercera pestaña "Equipo" para ver las tareas de todos.

**Chat (conversaciones)**
- Conversación 1 a 1 entre dos usuarios del equipo (no hay grupos).
- Se puede poner nombre a una conversación (por ejemplo el nombre de un cliente) para diferenciarla
  de simplemente "hablar con fulano".
- Se puede fijar (pin) una conversación para que quede arriba de la lista.
- Cada mensaje puede marcarse como "Urgente" (se resalta en rojo).
- Hay respuesta citada (reply a un mensaje puntual).
- Hay contador de no leídos y marca de leído por usuario (`leido_por`).
- Todo es tiempo real (Supabase Realtime): si dos personas están mirando el chat, ven los mensajes
  nuevos sin refrescar.

**Tareas**
- Se crea una tarea con: título, descripción, a quién se la asignás, quién la asigna (uno mismo),
  fecha de vencimiento (opcional), prioridad (Baja / Normal / Alta / Urgente), y opcionalmente
  vinculada a una conversación puntual.
- Estados: pendiente, en progreso, reprogramada, completada (con checkbox para marcar como hecha).
- Se ordenan automáticamente: primero las vencidas, después por estado, después por prioridad,
  después por fecha de vencimiento más próxima.
- Vista "Mis tareas" (asignadas a mí) vs. "Asignadas por mí" vs. (solo para `socia`) "Equipo".
- Hay tareas recurrentes previstas en el modelo de datos (tabla `tareas_recurrentes`: frecuencia,
  próxima fecha, checklist) pero **todavía no tienen pantalla propia en el frontend** — quedó
  migrado el dato del sistema viejo pero la funcionalidad de recurrencia no se re-implementó
  todavía en la app nueva.
