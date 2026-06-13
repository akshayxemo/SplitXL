import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Sun, Moon, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGuestUser, validateDisplayName } from "@/features/auth/auth"
import { useAuthStore } from "@/stores/auth.store"
import { deleteAccountData } from "@/features/accounts/accounts.db"
import {
  exportAllData,
  downloadExport,
  parseImportFile,
  importAllData,
} from "@/lib/export-import"
import { applyTheme, useUIStore } from "@/stores/ui.store"

type ForgetStep = "idle" | "warning" | "deleting"

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

function ThemeToggle() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const order = ["light", "dark", "system"] as const

  function cycle() {
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
    applyTheme(next)
  }

  const Icon = themeIcons[theme]
  return (
    <Button variant="ghost" size="icon-sm" onClick={cycle} aria-label="Toggle theme">
      <Icon className="size-4" />
    </Button>
  )
}

function ThemeSetting() {
  const theme = useUIStore((s) => s.theme);
  return (
    <div className="absolute flex items-center gap-2 top-4 right-4">
      <span className="text-sm">Theme: {theme}</span>
      <ThemeToggle />
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const lastAccount = useAuthStore((s) => s.lastAccount)
  const clearLastAccount = useAuthStore((s) => s.clearLastAccount)

  // New-account form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)

  // Forget-account modal state
  const [forgetStep, setForgetStep] = useState<ForgetStep>("idle")
  const [forgetError, setForgetError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Import state
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleContinue() {
    if (!lastAccount) return
    // Restore the prior session by creating/loading the account
    const user = await createGuestUser(lastAccount.displayName)
    setUser({ ...user, accountId: lastAccount.accountId })
    navigate("/dashboard", { replace: true })
  }

  async function handleNewAccountSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateDisplayName(displayName)
    if (err) { setNameError(err); return }
    setNameError(null)
    const user = await createGuestUser(displayName)
    setUser(user)
    navigate("/dashboard", { replace: true })
  }

  async function handleDeleteOnly() {
    if (!lastAccount) return
    setIsDeleting(true)
    setForgetError(null)
    try {
      await deleteAccountData(lastAccount.accountId)
      clearLastAccount()
      setForgetStep("idle")
      setShowNewForm(false)
    } catch (err) {
      setForgetError(err instanceof Error ? err.message : "Deletion failed.")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleExportAndDelete() {
    if (!lastAccount) return
    setIsDeleting(true)
    setForgetError(null)
    try {
      const payload = await exportAllData()
      downloadExport(payload)
      await deleteAccountData(lastAccount.accountId)
      clearLastAccount()
      setForgetStep("idle")
      setShowNewForm(false)
    } catch (err) {
      setForgetError(err instanceof Error ? err.message : "Export or deletion failed.")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const content = await file.text()
      const payload = parseImportFile(content)
      await importAllData(payload, { mode: "replace" })
      const importedAccountId =
        payload.account?.id ?? payload.data.accounts?.[0]?.id ?? crypto.randomUUID()
      const importedName =
        payload.account?.displayName ?? payload.data.accounts?.[0]?.displayName ?? "Imported"
      setUser({ accountId: importedAccountId, deviceId: "", displayName: importedName })
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.")
    } finally {
      // reset input so same file can be re-selected
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Forget modal
  if (forgetStep === "warning") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <ThemeSetting />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Forget this account?</CardTitle>
            <CardDescription>
              This will permanently delete all data for{" "}
              <strong>{lastAccount?.displayName}</strong> from this device. This
              cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {forgetError && (
              <p className="text-xs text-destructive">{forgetError}</p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setForgetStep("idle");
                setForgetError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportAndDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Exporting…" : "Export & Delete"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOnly}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete Without Export"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Recent account view
  if (lastAccount && !showNewForm) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <ThemeSetting />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Continue as <strong>{lastAccount.displayName}</strong> or choose
              another option.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {importError && (
              <p className="text-xs text-destructive">{importError}</p>
            )}
            <Button className="w-full" onClick={handleContinue}>
              Continue as {lastAccount.displayName}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNewForm(true)}
            >
              Create New Account
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => importInputRef.current?.click()}
            >
              Import Account Data
            </Button>
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                setForgetStep("warning");
                setForgetError(null);
              }}
            >
              Forget This Account
            </Button>
            {/* Hidden file input for import */}
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // New account form (default, or when "Create New Account" is chosen)
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ThemeSetting />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome to SplitXL</CardTitle>
          <CardDescription>
            Enter a display name to continue as a guest. No account needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleNewAccountSubmit}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-invalid={!!nameError}
                autoComplete="off"
                autoFocus
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
            {lastAccount && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowNewForm(false);
                  setNameError(null);
                }}
              >
                Back
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
