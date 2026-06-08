export function generateDeviceId(): string {
  const raw = `${navigator.userAgent}-${screen.width}x${screen.height}-${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  // Simple deterministic-ish fingerprint, not cryptographically unique
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return `device-${Math.abs(hash).toString(16)}`
}
