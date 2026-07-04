# NUB System - Frontend

Frontend de NUB System, una aplicacion profesional para gestion de barberia.

## Stack

- Next.js con App Router
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

### Auth0

En `.env.local`, pegar el client secret real en:

```env
AUTH0_CLIENT_SECRET=PEGA_TU_CLIENT_SECRET_ACA
```

Para desarrollo local actual, la app corre en `http://localhost:4017`.

Configurar en Auth0:

```text
Allowed Callback URLs
http://127.0.0.1:4017/auth/callback,
http://localhost:4017/auth/callback,
https://barberia-app.onrender.com/auth/callback

Allowed Logout URLs
http://127.0.0.1:4017,
http://localhost:4017,
https://barberia-app.onrender.com

Allowed Web Origins
http://127.0.0.1:4017,
http://localhost:4017,
https://barberia-app.onrender.com

Allowed Origins (CORS)
http://127.0.0.1:4017,
http://localhost:4017,
https://barberia-app.onrender.com
```

Si se cambia `APP_BASE_URL`, agregar en Auth0 el callback equivalente con `/auth/callback`.

Chequear tambien en Auth0:

- Application Type: `Regular Web Application`.
- Client Authentication / Token Endpoint Authentication Method: con client secret, no `None`.
- Grant Types: `Authorization Code` activo; si se mantiene el scope default del SDK, tambien `Refresh Token`.
- Connections: habilitar `google-oauth2` para esta aplicacion.

Despues de cambiar `.env.local`, reiniciar Next para que lea los secrets nuevos.

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
npm run start
npm run lint
```

## Deploy

El proyecto esta preparado para Vercel o Render. Para deploy estatico, revisar las rutas que dependan de APIs dinamicas antes de activar exportacion estatica.

## Estructura

- `src/app`: rutas App Router.
- `src/components`: componentes reutilizables.
- `src/lib`: configuracion, constantes y helpers compartidos.
- `src/types`: tipos TypeScript del dominio.

La app consume datos reales desde el backend configurado en `NEXT_PUBLIC_API_URL`. No se debe usar Google Sheets como base principal de datos.

La comunicacion live usa `NEXT_PUBLIC_SOCKET_URL`. Socket.IO solo notifica cambios para refrescar UI; la consistencia real queda en el backend y la base SQL.
