# Sistema de Comunicación — Estudio Jurídico Alonso

Chat interno + tareas para el equipo (Brenda, Evelyn, Cristina, Mia, Paulina, Virginia).
Reemplaza el viejo sistema en Google Sheets + Apps Script (que queda intacto como backup).

## Stack

- Frontend: React 19 + Vite, sin bundlear React/ReactDOM/Supabase (se cargan por CDN vía import map en `index.html`, ver comentario en `vite.config.js`)
- Backend: Supabase (Postgres + PostgREST + Realtime)
- Hosting: GitHub Pages, sirviendo el build (`dist/`) copiado a la raíz del repo

## Desarrollo local

```
npm install
npm run dev
```

## Build y deploy a GitHub Pages

```
npm run build
```

Esto genera `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css` con **rutas relativas**
(gracias a `base: './'` en `vite.config.js` — necesario porque el sitio vive en una subcarpeta
`/sistema-comunicacion/`, no en la raíz de `usuario.github.io`).

Para publicar: copiar el contenido de `dist/` a la raíz del repo (reemplazando `index.html` y `assets/`)
y hacer commit + push a `main`. GitHub Pages ya está configurado (Settings → Pages → branch `main` → `/`)
y reconstruye solo en un minuto.

## Seguridad — ver `02_seguridad_passwords.sql`

La tabla `usuarios` tiene la columna `password` en texto plano. Por eso el acceso público (rol `anon`/
`authenticated`) a esa tabla está **revocado**; la app solo puede leer la vista `usuarios_public`
(sin password). Cualquier código nuevo que necesite datos de usuarios debe usar `usuarios_public`,
nunca `usuarios` directo, o se rompe con 401.
