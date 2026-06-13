import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Archive, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { getAccountId, type CategoryScope } from "@/lib/db"
import { useAuthStore } from "@/stores/auth.store"
import {
  addCategory,
  archiveCategory,
  deleteCategory,
  formatCategoryLabel,
  getCategoriesForUser,
  updateCategory,
} from "@/features/categories/categories.db"

export function CategoriesPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("📁")
  const [scope, setScope] = useState<CategoryScope>("personal")
  const [color, setColor] = useState("#6366f1")
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const categories = useLiveQuery(() => getCategoriesForUser(accountId), [accountId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setError(null)
    await addCategory({
      name,
      emoji,
      scope,
      ownerAccountId: scope === "personal" ? accountId : undefined,
      color,
    })
    setName("")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-muted-foreground">Manage global and personal categories</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-5">
            <div>
              <Label>Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Scope</Label>
              <Select value={scope} onChange={(e) => setScope(e.target.value as CategoryScope)}>
                <option value="personal">Personal</option>
                <option value="global">Global</option>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add</Button>
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-5">{error}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {!categories ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          categories.map((cat) => (
            <Card key={cat.id} size="sm">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{cat.emoji ?? "📁"}</span>
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: cat.color ?? "#888" }}
                  />
                  <span className="font-medium">{formatCategoryLabel(cat)}</span>
                  <Badge variant="outline">{cat.scope}</Badge>
                </div>
                <div className="flex gap-1">
                  {cat.scope !== "global" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditId(cat.id)
                          setEditName(cat.name)
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => archiveCategory(cat.id)}>
                        <Archive className="size-4" />
                      </Button>
                      {cat.scope === "personal" && (
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(cat.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {editId && (
        <Card>
          <CardHeader><CardTitle>Edit Category</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
            <Button
              onClick={async () => {
                await updateCategory(editId, { name: editName })
                setEditId(null)
              }}
            >
              Save
            </Button>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete category?"
        description="This category will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteId) await deleteCategory(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
