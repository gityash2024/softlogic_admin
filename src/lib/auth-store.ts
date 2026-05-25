import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthTokens, SafeUserContext } from '@/types/api';

interface AuthState {
  tokens: AuthTokens | null;
  user: SafeUserContext | null;
  hydrated: boolean;
  setSession: (auth: { tokens: AuthTokens; user: SafeUserContext }) => void;
  updateUser: (user: SafeUserContext) => void;
  updateTokens: (tokens: AuthTokens) => void;
  clear: () => void;
  setHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      tokens: null,
      user: null,
      hydrated: false,
      setSession: ({ tokens, user }) => set({ tokens, user }),
      updateUser: (user) => set({ user }),
      updateTokens: (tokens) => set({ tokens }),
      clear: () => set({ tokens: null, user: null }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: 'softlogic-admin-auth',
      partialize: (state) => ({ tokens: state.tokens, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
