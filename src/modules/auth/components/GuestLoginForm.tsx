import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGuestLogin } from "../hooks/useGuestLogin"

interface GuestLoginFormProps {
  onSuccess?: () => void
}

export function GuestLoginForm({ onSuccess }: GuestLoginFormProps) {
  const { displayName, setDisplayName, error, handleSubmit } = useGuestLogin({ onSuccess })

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          Display name
        </label>
        <Input
          id="displayName"
          type="text"
          placeholder="Enter your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-invalid={!!error}
          autoComplete="off"
          autoFocus
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
      <Button type="submit" className="w-full">
        Continue
      </Button>
    </form>
  )
}
