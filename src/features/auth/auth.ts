import type { AuthUser } from "@/lib/db"
import { useAuthStore } from "@/stores/auth.store"

export function generateDeviceId(): string {
  const raw = `${navigator.userAgent}-${screen.width}x${screen.height}-${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return `device-${Math.abs(hash).toString(16)}`
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return "Display name is required."
  if (trimmed.length < 2) return "Display name must be at least 2 characters."
  if (trimmed.length > 32) return "Display name must be 32 characters or fewer."
  return null
}

export function createGuestUser(displayName: string): AuthUser {
  const existing = useAuthStore.getState().user

  return {
    userId: existing?.userId ?? crypto.randomUUID(),
    deviceId: existing?.deviceId ?? generateDeviceId(),
    displayName: displayName.trim(),
  }
}

export function updateDisplayName(displayName: string): AuthUser | null {
  const user = useAuthStore.getState().user
  if (!user) return null
  const error = validateDisplayName(displayName)
  if (error) throw new Error(error)
  return { ...user, displayName: displayName.trim() }
}
