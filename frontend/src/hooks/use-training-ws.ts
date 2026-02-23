"use client";

import { useEffect, useRef, useCallback } from "react";
import { createTrainingWebSocket } from "@/lib/api/client";
import { useTrainingStore } from "@/stores/training-store";
import type { TrainingUpdateMessage } from "@/types/api";

export function useTrainingWs() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const updateFromWsMessage = useTrainingStore((s) => s.updateFromWsMessage);

  const handleWsMessage = useCallback(
    (msg: TrainingUpdateMessage) => {
      updateFromWsMessage(msg);
    },
    [updateFromWsMessage],
  );

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = createTrainingWebSocket(handleWsMessage, () => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        const delay = Math.min(
          1000 * 2 ** reconnectAttempts.current,
          30000,
        );
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current += 1;
          connectWs();
        }, delay);
      });

      ws.onopen = () => {
        reconnectAttempts.current = 0;
      };

      ws.onclose = () => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        const delay = Math.min(
          1000 * 2 ** reconnectAttempts.current,
          30000,
        );
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current += 1;
          connectWs();
        }, delay);
      };

      wsRef.current = ws;
    } catch {
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectTimer.current = setTimeout(() => {
        reconnectAttempts.current += 1;
        connectWs();
      }, delay);
    }
  }, [handleWsMessage]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connectWs]);
}
