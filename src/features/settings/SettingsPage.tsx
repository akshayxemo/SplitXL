import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useAuthStore } from "@/stores/auth.store"
import { applyTheme, useUIStore } from "@/stores/ui.store"
import { updateDisplayName } from "@/features/auth/auth"
import {
  downloadExport,
  exportAllData,
  exportExpensesCsv,
  importAllData,
  parseImportFile,
} from "@/lib/export-import"
import { db } from "@/lib/db"

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)!
  const setUser = useAuthStore((s) => s.setUser)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const [displayName, setDisplayName] = useState(user.displayName)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExportJson() {
    const payload = await exportAllData()
    downloadExport(payload)
    setMessage("Backup downloaded.")
  }

  async function handleExportCsv() {
    const expenses = await db.personalExpenses.where("ownerUserId").equals(user.userId).toArray()
    const categories = await db.categories.toArray()
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
    exportExpensesCsv(expenses, categoryMap)
    setMessage("CSV exported.")
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setMessage(null)
    try {
      const content = await file.text()
      const payload = parseImportFile(content)
      await importAllData(payload, { replace: true })
      setMessage("Data imported successfully.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.")
    }
    e.target.value = ""
  }

  function handleSaveProfile() {
    try {
      const updated = updateDisplayName(displayName)
      if (updated) {
        setUser(updated)
        setMessage("Profile updated.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    }
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
        <p className="text-muted-foreground">Profile, theme, and data management</p>
      </div>

      {message && <p className="text-sm text-primary">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Guest user profile (local only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">User ID: {user.userId}</p>
          <Button onClick={handleSaveProfile}>Save Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Theme</Label>
          <Select value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Download your data for backup or transfer</CardDescription>
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
          <CardDescription>Restore from a JSON backup (replaces all data)</CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Import JSON
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
