"use client";

import { useEffect, useState } from "react";
import { RadioTower } from "lucide-react";
import { getSocket } from "@/lib/socket";

type ConnectionState = "connecting" | "connected" | "offline";

export function LiveConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const socket = getSocket();

    function handleConnect() {
      setState("connected");
      socket.emit("room:join", { room: "role:recepcion" });
    }

    function handleDisconnect() {
      setState("offline");
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  const label = {
    connecting: "Conectando live",
    connected: "Agenda live",
    offline: "Live offline",
  }[state];

  const stateClass = {
    connecting: "border-brass/30 bg-brass/10 text-brass",
    connected: "border-sage/30 bg-sage/10 text-sage",
    offline: "border-clay/30 bg-clay/10 text-clay",
  }[state];

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${stateClass}`}
    >
      <RadioTower className="h-4 w-4" aria-hidden="true" />
      {label}
    </div>
  );
}
