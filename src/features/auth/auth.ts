import type { AuthUser } from "@/lib/db"
import { syncAuthAccount } from "@/lib/db-migrate"
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

export function normalizeAuthUser(user: AuthUser): AuthUser {
  const accountId = user.accountId ?? user.userId ?? crypto.randomUUID()
  return {
    accountId,
    deviceId: user.deviceId,
    displayName: user.displayName,
  }
}

export async function createGuestUser(displayName: string): Promise<AuthUser> {
  const existing = useAuthStore.getState().user
  const accountId = existing?.accountId ?? existing?.userId ?? crypto.randomUUID()

  const user: AuthUser = {
    accountId,
    deviceId: existing?.deviceId ?? generateDeviceId(),
    displayName: displayName.trim(),
  }

  await syncAuthAccount(user.accountId, user.displayName)
  return user
}

export async function updateDisplayName(displayName: string): Promise<AuthUser | null> {
  const user = useAuthStore.getState().user
  if (!user) return null
  const error = validateDisplayName(displayName)
  if (error) throw new Error(error)
  const normalized = normalizeAuthUser(user)
  const updated = { ...normalized, displayName: displayName.trim() }
  await syncAuthAccount(updated.accountId, updated.displayName)
  return updated
}
