import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/core/auth/authSession';
import type { SessionInvalidation } from '@/core/auth/sessionInvalidation';

const SESSION_REPLACED_EVENT = 'auth:session-replaced';
const COMPANY_MODULES_UPDATED_EVENT = 'company_modules_updated';
const DEFAULT_MESSAGE = 'Phiên đăng nhập đã được sử dụng trên thiết bị khác. Vui lòng đăng nhập lại.';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const socketUrl = configuredApiUrl?.replace(/\/api\/v1$/i, '');

let activeSocket: Socket | null = null;

export type CompanyModulesUpdatedEvent = { companyCode: string; enabledModules: string[] };

export function connectAuthSessionSocket(
  onSessionInvalidated: (reason: SessionInvalidation) => void,
  onCompanyModulesUpdated?: (event: CompanyModulesUpdatedEvent) => void,
) {
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
  socket.on(COMPANY_MODULES_UPDATED_EVENT, (payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const event = payload as { companyCode?: unknown; enabledModules?: unknown };
    if (typeof event.companyCode !== 'string' || !Array.isArray(event.enabledModules)) return;
    const enabledModules = event.enabledModules.filter((key): key is string => typeof key === 'string');
    if (event.enabledModules.length > 0 && enabledModules.length === 0) return;
    onCompanyModulesUpdated?.({ companyCode: event.companyCode, enabledModules });
  });
  socket.on('connect_error', (error: Error) => {
    if (/session replaced|access changed/i.test(error.message)) {
      invalidate({ code: 'SESSION_REPLACED', message: DEFAULT_MESSAGE });
    }
  });

  return () => {
    socket.off(SESSION_REPLACED_EVENT);
    socket.off(COMPANY_MODULES_UPDATED_EVENT);
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
