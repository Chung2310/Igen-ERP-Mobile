import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/core/auth/authSession';
import type { SessionInvalidation } from '@/core/auth/sessionInvalidation';

const SESSION_REPLACED_EVENT = 'auth:session-replaced';
const DEFAULT_MESSAGE = 'Phiên đăng nhập đã được sử dụng trên thiết bị khác. Vui lòng đăng nhập lại.';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const socketUrl = configuredApiUrl?.replace(/\/api\/v1$/i, '');

let activeSocket: Socket | null = null;

export function connectAuthSessionSocket(onSessionInvalidated: (reason: SessionInvalidation) => void) {
  const token = getAccessToken();
  if (!token || !socketUrl) return () => {};

  const socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });
  activeSocket = socket;
  let invalidated = false;

  const invalidate = (reason: SessionInvalidation) => {
    if (invalidated) return;
    invalidated = true;
    socket.disconnect();
    onSessionInvalidated({
      code: reason.code || 'SESSION_REPLACED',
      message: reason.message || DEFAULT_MESSAGE,
    });
  };

  socket.on(SESSION_REPLACED_EVENT, (payload: SessionInvalidation = {}) => invalidate(payload));
  socket.on('connect_error', (error: Error) => {
    if (/session replaced|access changed/i.test(error.message)) {
      invalidate({ code: 'SESSION_REPLACED', message: DEFAULT_MESSAGE });
    }
  });

  return () => {
    socket.off(SESSION_REPLACED_EVENT);
    socket.off('connect_error');
    if (activeSocket === socket) activeSocket = null;
    socket.disconnect();
  };
}

export function updateAuthSessionSocketToken(token: string) {
  if (!activeSocket) return;
  activeSocket.auth = { token };
  if (activeSocket.connected) activeSocket.disconnect().connect();
  else activeSocket.connect();
}
