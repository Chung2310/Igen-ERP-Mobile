import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentErpUser, signInToErp, signOutFromErp, type ErpUser } from '@/core/auth/authApi';
import { clearAccessToken, restoreAccessToken } from '@/core/auth/authSession';

type AuthContextValue = {
  user: ErpUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<ErpUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const token = await restoreAccessToken();
        if (token) {
          const currentUser = await getCurrentErpUser();
          if (active) setUser(currentUser);
        }
      } catch {
        await clearAccessToken();
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const currentUser = await signInToErp(email, password);
    setUser(currentUser);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutFromErp();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, isLoading, signIn, signOut }), [user, isLoading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được gọi bên trong AuthProvider.');
  return context;
}
