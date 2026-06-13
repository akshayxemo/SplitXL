import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Archive, Edit2, Eye, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { getAccountId } from "@/lib/db"
import { useAuthStore } from "@/stores/auth.store"
import {
  addFriend,
  archiveFriend,
  deleteFriend,
  getFriends,
  restoreFriend,
  updateFriend,
} from "@/features/friends/friends.db"
import type { Friend } from "@/lib/db"

interface EditState {
  id: string
  displayName: string
  email: string
  phone: string
  notes: string
}

export function FriendsPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [showArchived, setShowArchived] = useState(false)

  // Add form state
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  // Edit state
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // View state
  const [viewFriend, setViewFriend] = useState<Friend | null>(null)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const friends = useLiveQuery(() => getFriends(accountId, showArchived), [accountId, showArchived])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    try {
      await addFriend({ ownerAccountId: accountId, displayName, email, phone, notes })
      setDisplayName("")
      setEmail("")
      setPhone("")
      setNotes("")
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add friend.")
    }
  }

  function startEdit(friend: Friend) {
    setEditState({
      id: friend.id,
      displayName: friend.displayName,
      email: friend.email ?? "",
      phone: friend.phone ?? "",
      notes: friend.notes ?? "",
    })
    setEditError(null)
    setViewFriend(null)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    setEditError(null)
    try {
      await updateFriend(editState.id, {
        displayName: editState.displayName,
        email: editState.email,
        phone: editState.phone,
        notes: editState.notes,
      })
      setEditState(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update friend.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Friends</h1>
          <p className="text-muted-foreground">Global contact list for group members</p>
        </div>
        <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Friend</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {addError && <p className="text-sm text-destructive sm:col-span-2">{addError}</p>}
            <Button type="submit" className="sm:col-span-2 w-fit">Add Friend</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(friends ?? []).map((friend) => (
          <div key={friend.id} className="space-y-0">
            <Card size="sm">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{friend.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {[friend.email, friend.phone].filter(Boolean).join(" · ") || "No contact info"}
                  </p>
                  {friend.notes && <p className="text-xs text-muted-foreground mt-1">{friend.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {friend.isArchived && <Badge variant="outline">Archived</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => setViewFriend(viewFriend?.id === friend.id ? null : friend)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(friend)}>
                    <Edit2 className="size-4" />
                  </Button>
                  {friend.isArchived ? (
                    <Button size="sm" variant="outline" onClick={() => restoreFriend(friend.id)}>Restore</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => archiveFriend(friend.id)}>
                      <Archive className="size-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(friend.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* View detail panel */}
            {viewFriend?.id === friend.id && (
              <Card size="sm" className="border-t-0 rounded-t-none bg-muted/40">
                <CardContent className="py-4 grid gap-1 text-sm">
                  <p className="font-semibold mb-1">Friend Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Name</span>
                    <span>{friend.displayName}</span>
                    <span className="text-muted-foreground">Email</span>
                    <span>{friend.email || "—"}</span>
                    <span className="text-muted-foreground">Phone</span>
                    <span>{friend.phone || "—"}</span>
                    <span className="text-muted-foreground">Notes</span>
                    <span>{friend.notes || "—"}</span>
                    <span className="text-muted-foreground">Status</span>
                    <span>{friend.isArchived ? "Archived" : "Active"}</span>
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(friend.createdAt).toLocaleDateString()}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="w-fit mt-2" onClick={() => setViewFriend(null)}>
                    Close
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Inline edit form */}
            {editState?.id === friend.id && (
              <Card size="sm" className="border-t-0 rounded-t-none bg-muted/40">
                <CardContent className="py-4">
                  <p className="font-semibold text-sm mb-3">Edit Friend</p>
                  <form onSubmit={handleEditSave} className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editState.displayName}
                        onChange={(e) => setEditState({ ...editState, displayName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={editState.email}
                        onChange={(e) => setEditState({ ...editState, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={editState.phone}
                        onChange={(e) => setEditState({ ...editState, phone: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={editState.notes}
                        onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                      />
                    </div>
                    {editError && <p className="text-sm text-destructive sm:col-span-2">{editError}</p>}
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditState(null)}>Cancel</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete friend?"
        description="This friend will be permanently removed. Linked group members will be unlinked."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteId) await deleteFriend(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
