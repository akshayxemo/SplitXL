import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AuthUser } from "@/lib/db"
import { normalizeAuthUser } from "@/features/auth/auth"

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user: normalizeAuthUser(user) }),
      logout: () => set({ user: null }),
    }),
    {
      name: "auth_user",
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.setUser(normalizeAuthUser(state.user))
        }
      },
    }
  )
)
