export const appConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api",
  socketUrl:
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:5000",
  backendUrl:
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000",
  frontendUrl:
    process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000",
  auth0Domain:
    process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "dev-1a67u9mz.us.auth0.com",
  auth0ClientId:
    process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "MRrsVJYMkQ7hK5LCVGTvfyR1ereHvoQZ",
};
