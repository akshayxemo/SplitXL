import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AuthUser } from "@/lib/db"
import { normalizeAuthUser } from "@/features/auth/auth"

interface LastAccount {
  accountId: string
  displayName: string
}

interface AuthState {
  user: AuthUser | null
  lastAccount: LastAccount | null
  setUser: (user: AuthUser) => void
  logout: () => void
  clearLastAccount: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      lastAccount: null,
      setUser: (user) => set({ user: normalizeAuthUser(user) }),
      logout: () => {
        const current = get().user
        set({
          user: null,
          lastAccount: current
            ? { accountId: current.accountId, displayName: current.displayName }
            : get().lastAccount,
        })
      },
      clearLastAccount: () => set({ lastAccount: null }),
    }),
    {
      name: "auth_user",
      partialize: (state) => ({ user: state.user, lastAccount: state.lastAccount }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.setUser(normalizeAuthUser(state.user))
        }
      },
    }
  )
)
