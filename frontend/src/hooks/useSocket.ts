'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socketInstance: Socket | null = null;

export function useSocket() {
  const { token } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(socketInstance);

  useEffect(() => {
    if (!token) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setSocket(null);
      }
      return;
    }

    if (!socketInstance) {
      socketInstance = io(`${API_BASE_URL}/realtime`, {
        auth: {
          token: `Bearer ${token}`,
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      });

      setSocket(socketInstance);
    } else {
      // If token changed, update auth token and reconnect
      const currentAuth = socketInstance.auth as { token?: string } | undefined;
      if (currentAuth?.token !== `Bearer ${token}`) {
        socketInstance.auth = { token: `Bearer ${token}` };
        if (socketInstance.connected) {
          socketInstance.disconnect().connect();
        } else {
          socketInstance.connect();
        }
      }
    }

    const handleConnect = () => {
      setSocket(socketInstance);
    };

    const handleDisconnect = () => {
      // Keep hook's reference updated but let socketInstance try to auto-reconnect
      setSocket(socketInstance);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    // Initial sync
    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.off('connect', handleConnect);
        socketInstance.off('disconnect', handleDisconnect);
      }
    };
  }, [token]);

  return socket;
}
