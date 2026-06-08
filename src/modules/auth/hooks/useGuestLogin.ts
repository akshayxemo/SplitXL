import { useState } from "react"
import { createGuestUser } from "../services/auth.service"
import { useAuthStore } from "../store/auth.store"

interface UseGuestLoginOptions {
  onSuccess?: () => void
}

export function useGuestLogin({ onSuccess }: UseGuestLoginOptions = {}) {
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const setUser = useAuthStore((state) => state.setUser)

  function validate(): boolean {
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError("Display name is required.")
      return false
    }
    if (trimmed.length < 2) {
      setError("Display name must be at least 2 characters.")
      return false
    }
    if (trimmed.length > 32) {
      setError("Display name must be 32 characters or fewer.")
      return false
    }
    setError(null)
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const user = createGuestUser(displayName.trim())
    setUser(user)
    onSuccess?.()
  }

  return { displayName, setDisplayName, error, handleSubmit }
}
