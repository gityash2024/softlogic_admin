import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, SafeUserContext, UserRole } from '@/types/api';

/**
 * A super-admin "view as" session. Held in memory only (never persisted), so a
 * page reload always drops back to the real admin session. While set, the API
 * client sends this access token instead of the admin's; the admin's own
 * persisted {tokens, user} are left untouched so exiting is instant and safe.
 */
export interface ImpersonationSession {
  accessToken: string;
  user: { id: string; email: string; name: string | null; role: UserRole };
}

interface AuthState {
  tokens: AuthTokens | null;
  user: SafeUserContext | null;
  hydrated: boolean;
  impersonation: ImpersonationSession | null;
  setSession: (auth: { tokens: AuthTokens; user: SafeUserContext }) => void;
  updateUser: (user: SafeUserContext) => void;
  updateTokens: (tokens: AuthTokens) => void;
  clear: () => void;
  setHydrated: (value: boolean) => void;
  startImpersonation: (session: ImpersonationSession) => void;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tokens: null,
      user: null,
      hydrated: false,
      impersonation: null,
      setSession: ({ tokens, user }) => set({ tokens, user }),
      updateUser: (user) => set({ user }),
      updateTokens: (tokens) => set({ tokens }),
      clear: () => set({ tokens: null, user: null, impersonation: null }),
      setHydrated: (value) => set({ hydrated: value }),
      startImpersonation: (session) => set({ impersonation: session }),
      stopImpersonation: () => set({ impersonation: null }),
    }),
    {
      name: 'softlogic-admin-auth',
      // impersonation is intentionally omitted — it must never persist.
      partialize: (state) => ({ tokens: state.tokens, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
