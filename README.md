# NUB System - Frontend

Frontend de NUB System, una aplicacion profesional para gestion de barberia.

## Stack

- Next.js con App Router exportado como static site
- React
- TypeScript
- Tailwind CSS
- Recharts para dashboards
- Socket.IO Client para actualizaciones live
- Lucide React para iconografia

## Instalacion

```bash
npm install
```

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y ajustar los valores:

```bash
cp .env.local.example .env.local
```

### Auth0 para static site

El frontend estatico no usa `AUTH0_CLIENT_SECRET` ni `AUTH0_SECRET`. Esos secretos no pueden vivir en un static site.

```env
NEXT_PUBLIC_AUTH0_DOMAIN=dev-1a67u9mz.us.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=MRrsVJYMkQ7hK5LCVGTvfyR1ereHvoQZ
```

Para desarrollo local actual, la app corre en `http://localhost:4017`.

Configurar en Auth0:

```text
Allowed Callback URLs
http://127.0.0.1:4017/auth0/complete/,
http://127.0.0.1:4017/auth0/complete,
http://localhost:4017/auth0/complete/,
http://localhost:4017/auth0/complete,
https://TU-FRONTEND.onrender.com/auth0/complete/,
https://TU-FRONTEND.onrender.com/auth0/complete

Allowed Logout URLs
http://127.0.0.1:4017,
http://localhost:4017,
https://TU-FRONTEND.onrender.com

Allowed Web Origins
http://127.0.0.1:4017,
http://localhost:4017,
https://TU-FRONTEND.onrender.com

Allowed Origins (CORS)
http://127.0.0.1:4017,
http://localhost:4017,
https://TU-FRONTEND.onrender.com
```

Chequear tambien en Auth0:

- Application Type: `Single Page Application`.
- Grant Types: `Authorization Code` activo.
- El login usa Authorization Code + PKCE, sin client secret.
- Connections: habilitar `google-oauth2` para esta aplicacion.

El backend valida el `id_token` de Auth0 con JWKS en `/api/auth/auth0` y recien ahi emite el JWT interno de NUB.

### Imagenes / Cloudinary

La subida de imagenes se hace contra el backend en `/api/uploads/image`. Configurar en el backend:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_FOLDER_NAME=nub-system
```

No poner `CLOUDINARY_API_SECRET` en el frontend.

## Comandos

```bash
npm run dev
npm run build
npm run lint
```

## Deploy

El proyecto esta preparado para Render Static Site.

Render Static Site:

```text
Build Command: npm install && npm run build
Publish Directory: out
Root Directory: vacio, si el repo contiene solo este frontend
```

Variables de entorno en Render:

```env
NEXT_PUBLIC_API_URL=https://TU-BACKEND.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://TU-BACKEND.onrender.com
NEXT_PUBLIC_BACKEND_URL=https://TU-BACKEND.onrender.com
NEXT_PUBLIC_FRONTEND_URL=https://TU-FRONTEND.onrender.com
NEXT_PUBLIC_AUTH0_DOMAIN=dev-1a67u9mz.us.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=MRrsVJYMkQ7hK5LCVGTvfyR1ereHvoQZ
```

No configurar `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` ni Cloudinary secrets en el frontend static.

## Estructura

- `src/app`: rutas App Router.
- `src/components`: componentes reutilizables.
- `src/lib`: configuracion, constantes y helpers compartidos.
- `src/types`: tipos TypeScript del dominio.

La app consume datos reales desde el backend configurado en `NEXT_PUBLIC_API_URL`. No se debe usar Google Sheets como base principal de datos.

La comunicacion live usa `NEXT_PUBLIC_SOCKET_URL`. Socket.IO solo notifica cambios para refrescar UI; la consistencia real queda en el backend y la base SQL.
