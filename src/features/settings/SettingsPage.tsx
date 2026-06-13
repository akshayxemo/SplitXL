import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Download, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { getAccountId } from "@/lib/db"
import { useAuthStore } from "@/stores/auth.store"
import { applyTheme, useUIStore } from "@/stores/ui.store"
import { normalizeAuthUser, updateDisplayName } from "@/features/auth/auth"
import { deleteAccountData, updateAccount } from "@/features/accounts/accounts.db"
import {
  buildImportPreview,
  downloadExport,
  exportAllData,
  exportExpensesCsv,
  importAllData,
  parseImportFile,
  type ExportPayload,
  type ImportPreview,
} from "@/lib/export-import"
import { db } from "@/lib/db"
import { getAccount } from "@/features/accounts/accounts.db"

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const [displayName, setDisplayName] = useState(user.displayName)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importPayload, setImportPayload] = useState<ExportPayload | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace")
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteStep, setDeleteStep] = useState<"choose" | "confirm">("choose")

  useEffect(() => {
    void getAccount(accountId).then((acc) => {
      if (acc?.email) setEmail(acc.email)
      if (acc?.phone) setPhone(acc.phone)
    })
  }, [accountId])

  async function handleExportJson() {
    const account = await getAccount(accountId)
    const payload = await exportAllData(account)
    downloadExport(payload)
    setMessage("Backup downloaded.")
  }

  async function handleExportCsv() {
    const expenses = await db.personalExpenses.where("ownerAccountId").equals(accountId).toArray()
    const categories = await db.categories.toArray()
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, `${c.emoji ?? ""} ${c.name}`]))
    exportExpensesCsv(expenses, categoryMap)
    setMessage("CSV exported.")
  }

  async function handleImportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setMessage(null)
    try {
      const content = await file.text()
      const payload = parseImportFile(content)
      setImportPayload(payload)
      setImportPreview(buildImportPreview(payload))
      setShowImportModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.")
    }
    e.target.value = ""
  }

  async function executeImport() {
    if (!importPayload) return
    try {
      await importAllData(importPayload, {
        mode: importMode,
        newUser: normalizeAuthUser(user),
      })
      if (importPayload.account) {
        setUser(normalizeAuthUser({ ...user, accountId: importPayload.account.id, displayName: importPayload.account.displayName }))
      }
      setMessage("Data imported successfully.")
      setShowImportModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.")
    }
  }

  async function handleSaveProfile(e?: React.FormEvent) {
    e?.preventDefault()
    setMessage(null)
    setError(null)
    try {
      const updated = await updateDisplayName(displayName)
      if (updated) {
        setUser(updated)
        await updateAccount(accountId, { displayName, email: email || undefined, phone: phone || undefined })
        setMessage("Profile updated.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    }
  }

  async function handleDeleteAccount(exportFirst: boolean) {
    if (exportFirst) await handleExportJson()
    await deleteAccountData(accountId)
    logout()
    navigate("/login", { replace: true })
  }

  function handleThemeChange(value: string) {
    const newTheme = value as "light" | "dark" | "system"
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Account, theme, and data management</p>
      </div>

      {message && <p className="text-sm text-primary">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Local account profile</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <Label>Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Email (optional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Phone (optional)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Account ID: {accountId}</p>
            <Button type="submit">Update Profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Theme</Label>
          <Select value={theme} onChange={(e) => handleThemeChange(e.target.value)} className="bg-background text-foreground">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Download your complete account data</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleExportJson}>
            <Download className="size-4" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="size-4" />
            Export Expenses CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Import</CardTitle>
          <CardDescription>Restore or merge from a JSON backup</CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFileSelect} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Import JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setDeleteStep("choose"); setShowDeleteModal(true) }}>
            <Trash2 className="size-4" />
            Delete Account
          </Button>
          <ConfirmationModal
            open={showDeleteModal && deleteStep === "choose"}
            onOpenChange={setShowDeleteModal}
            title="Delete your account?"
            description="Deleting your account will permanently remove all local data from this device."
            confirmLabel="Export & Delete"
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={async () => {
              await handleDeleteAccount(true)
              setShowDeleteModal(false)
            }}
          />
        </CardContent>
      </Card>

      <ConfirmationModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        title="Import data"
        description={
          importPreview
            ? `Account: ${importPreview.accountName}. Will import ${importPreview.groups} groups, ${importPreview.transactions} transactions, ${importPreview.categories} categories, ${importPreview.friends} friends.`
            : "Importing data may replace or merge with your existing data."
        }
        confirmLabel={importMode === "replace" ? "Replace Existing Data" : "Merge Data"}
        onConfirm={executeImport}
      />

      {showImportModal && importPreview && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Label>Import mode</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                />
                Replace Existing Data
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                />
                Merge Data
              </label>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
