import { AppState, Platform } from 'react-native';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentErpUser, signInToErp, signOutFromErp, type ErpUser } from '@/core/auth/authApi';
import {
  clearAccessToken,
  clearActiveBranchId,
  getAccessToken,
  restoreAccessToken,
  restoreActiveBranchId,
  saveActiveBranchId,
} from '@/core/auth/authSession';
import { notifySessionInvalidation, subscribeToSessionInvalidation } from '@/core/auth/sessionInvalidation';
import { connectAuthSessionSocket } from '@/core/auth/sessionSocket';
import { isAppLockSuspended } from '@/core/auth/appLockSuspension';
import {
  authenticateBiometric,
  biometricErrorMessage,
  DEFAULT_BIOMETRIC_SETTINGS,
  getBiometricAvailability,
  getBiometricSettings,
  saveBiometricSettings,
  type BiometricSettings,
} from '@/core/auth/biometricAuth';

type AuthContextValue = {
  user: ErpUser | null;
  isLoading: boolean;
  isAppLocked: boolean;
  canSignInWithBiometrics: boolean;
  biometricSettings: BiometricSettings;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  activeBranchId: string | undefined;
  setActiveBranchId: (value: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithBiometrics: () => Promise<void>;
  unlockApp: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateBiometricSettings: (settings: BiometricSettings) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<ErpUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | undefined>(undefined);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [hasPendingBiometricSession, setHasPendingBiometricSession] = useState(false);
  const [canSignInWithBiometrics, setCanSignInWithBiometrics] = useState(false);
  const [biometricSettings, setBiometricSettings] = useState(DEFAULT_BIOMETRIC_SETTINGS);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  useEffect(() => subscribeToSessionInvalidation((reason) => {
    void clearAccessToken();
    void clearActiveBranchId();
    setActiveBranchId(undefined);
    setUser(null);
    setIsAppLocked(false);
    setHasPendingBiometricSession(false);
    setCanSignInWithBiometrics(false);
    setSessionNotice(reason.message || 'Phiên đăng nhập đã được sử dụng trên thiết bị khác. Vui lòng đăng nhập lại.');
  }), []);

  useEffect(() => {
    if (!user) return;
    return connectAuthSessionSocket(notifySessionInvalidation, (event) => {
      const currentCompany = user.companyCode?.trim().toUpperCase();
      if (!currentCompany || event.companyCode.trim().toUpperCase() !== currentCompany) return;
      setUser((current) => {
        if (!current || current.companyCode?.trim().toUpperCase() !== currentCompany) return current;
        return { ...current, enabledModules: event.enabledModules };
      });
    });
  }, [user]);

  useEffect(() => {
    if (Platform.OS === 'web' || !user || !biometricSettings.appLockEnabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !isAppLockSuspended()) setIsAppLocked(true);
    });
    return () => subscription.remove();
  }, [biometricSettings.appLockEnabled, user?._id, user?.id]);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const settings = await getBiometricSettings();
        if (active) setBiometricSettings(settings);

        const token = await restoreAccessToken();
        if (token) {
          if (settings.appLockEnabled) {
            if (active) {
              setHasPendingBiometricSession(true);
              setCanSignInWithBiometrics(true);
              setIsAppLocked(true);
            }
            return;
          }
          if (settings.loginEnabled) {
            if (active) setCanSignInWithBiometrics(true);
            return;
          }

          const currentUser = await getCurrentErpUser();
          const savedBranchId = await restoreActiveBranchId();
          if (active) {
            setUser(currentUser);
            setActiveBranchId(currentUser.branchId || savedBranchId || undefined);
          }
        }
      } catch {
        await clearAccessToken();
        await clearActiveBranchId();
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const currentUser = await signInToErp(email, password);
    const savedBranchId = await restoreActiveBranchId();
    setSessionNotice(null);
    setActiveBranchId(currentUser.branchId || savedBranchId || undefined);
    setUser(currentUser);
    setIsAppLocked(false);
    setHasPendingBiometricSession(false);
    setCanSignInWithBiometrics(Boolean(biometricSettings.loginEnabled));
  }, [biometricSettings.loginEnabled]);

  const signInWithBiometrics = useCallback(async () => {
    const availability = await getBiometricAvailability('loginEnabled');
    if (!availability.available) throw new Error(availability.message || 'Sinh trắc học chưa sẵn sàng.');

    const result = await authenticateBiometric('loginEnabled', 'Đăng nhập vào ERP Mobile');
    if (!result.success) throw new Error(biometricErrorMessage(result.error));

    const token = await restoreAccessToken();
    if (!token) {
      setCanSignInWithBiometrics(false);
      throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập bằng mật khẩu.');
    }

    try {
      const currentUser = await getCurrentErpUser();
      const savedBranchId = await restoreActiveBranchId();
      setSessionNotice(null);
      setActiveBranchId(currentUser.branchId || savedBranchId || undefined);
      setUser(currentUser);
      setIsAppLocked(false);
      setHasPendingBiometricSession(false);
      setCanSignInWithBiometrics(false);
    } catch (error) {
      await clearAccessToken();
      setCanSignInWithBiometrics(false);
      throw error;
    }
  }, []);

  const unlockApp = useCallback(async () => {
    const availability = await getBiometricAvailability('appLockEnabled');
    if (!availability.available) throw new Error(availability.message || 'Sinh trắc học chưa sẵn sàng.');

    const result = await authenticateBiometric('appLockEnabled', 'Mở khóa ERP Mobile');
    if (!result.success) {
      if (['user_cancel', 'app_cancel', 'system_cancel', 'user_fallback'].includes(result.error || '')) return;
      throw new Error(biometricErrorMessage(result.error));
    }

    if (hasPendingBiometricSession) {
      const token = await restoreAccessToken();
      if (!token) {
        setHasPendingBiometricSession(false);
        setCanSignInWithBiometrics(false);
        setIsAppLocked(false);
        throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại bằng mật khẩu.');
      }

      try {
        const currentUser = await getCurrentErpUser();
        const savedBranchId = await restoreActiveBranchId();
        setSessionNotice(null);
        setActiveBranchId(currentUser.branchId || savedBranchId || undefined);
        setUser(currentUser);
        setHasPendingBiometricSession(false);
        setCanSignInWithBiometrics(false);
      } catch (error) {
        await clearAccessToken();
        await clearActiveBranchId();
        setActiveBranchId(undefined);
        setHasPendingBiometricSession(false);
        setCanSignInWithBiometrics(false);
        setIsAppLocked(false);
        throw error;
      }
    }

    setIsAppLocked(false);
  }, [hasPendingBiometricSession]);

  const signOut = useCallback(async () => {
    try {
      await signOutFromErp();
    } finally {
      await clearActiveBranchId();
      setSessionNotice(null);
      setActiveBranchId(undefined);
      setUser(null);
      setIsAppLocked(false);
      setHasPendingBiometricSession(false);
      setCanSignInWithBiometrics(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentErpUser();
    setUser(currentUser);
  }, []);

  const updateBiometricSettings = useCallback(async (settings: BiometricSettings) => {
    await saveBiometricSettings(settings);
    setBiometricSettings(settings);
    if (!settings.appLockEnabled) setIsAppLocked(false);
    setCanSignInWithBiometrics(Boolean(settings.loginEnabled && (user || getAccessToken())));
  }, [user]);

  useEffect(() => {
    const canSwitchBranch = user?.role === 'admin' || user?.role === 'superadmin' || !user?.branchId;
    if (!canSwitchBranch && user?.branchId && activeBranchId !== user.branchId) {
      setActiveBranchId(user.branchId);
    } else if (user && activeBranchId) {
      void saveActiveBranchId(activeBranchId);
    }
  }, [activeBranchId, user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionNotice,
      clearSessionNotice,
      activeBranchId,
      setActiveBranchId,
      isAppLocked,
      canSignInWithBiometrics,
      biometricSettings,
      signIn,
      signInWithBiometrics,
      unlockApp,
      signOut,
      refreshUser,
      updateBiometricSettings,
    }),
    [user, isLoading, sessionNotice, clearSessionNotice, activeBranchId, isAppLocked, canSignInWithBiometrics, biometricSettings, signIn, signInWithBiometrics, unlockApp, signOut, refreshUser, updateBiometricSettings],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được gọi bên trong AuthProvider.');
  return context;
}
