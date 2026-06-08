import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AuthUser } from "../types/auth.types"

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem("auth_user")
        set({ user: null })
      },
    }),
    {
      name: "auth_user", // localStorage key — keeps compatibility with existing data
      partialize: (state) => ({ user: state.user }), // only persist user, not actions
    }
  )
)
