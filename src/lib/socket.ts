import { io, type Socket } from "socket.io-client";
import { appConfig } from "@/lib/config";
import { readToken } from "@/lib/auth-storage";

let socket: Socket | null = null;

export function getSocket(token = readToken()): Socket {
  if (!socket) {
    socket = io(appConfig.socketUrl, {
      autoConnect: false,
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
    });
  } else {
    socket.auth = token ? { token } : {};
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}
