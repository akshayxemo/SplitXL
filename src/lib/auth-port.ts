import { useAuthStore } from "@/stores/auth.store"
import type { AuthUser } from "@/lib/db"

export function getCurrentUser(): AuthUser | null {
  return useAuthStore.getState().user
}

export function requireCurrentUser(): AuthUser {
  const user = getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  return user
}
