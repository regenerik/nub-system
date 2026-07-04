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
};
