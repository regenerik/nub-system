"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";

type SocketHandler = (payload: unknown) => void;

export function useSocket(events: Record<string, SocketHandler>, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const socket = getSocket();
    Object.entries(events).forEach(([event, handler]) => socket.on(event, handler));
    socket.connect();
    return () => {
      Object.entries(events).forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [enabled, events]);
}
