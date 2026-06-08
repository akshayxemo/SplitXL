import type { AuthUser } from "../types/auth.types"
import { generateDeviceId } from "../utils/device"

const STORAGE_KEY = "auth_user"

export function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function saveUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function createGuestUser(displayName: string): AuthUser {
  const existing = loadStoredUser()

  const user: AuthUser = {
    userId: existing?.userId ?? crypto.randomUUID(),
    deviceId: existing?.deviceId ?? generateDeviceId(),
    displayName,
  }

  saveUser(user)
  return user
}
