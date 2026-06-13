import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Archive, Trash2 } from "lucide-react"
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
} from "@/features/friends/friends.db"

export function FriendsPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [showArchived, setShowArchived] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const friends = useLiveQuery(() => getFriends(accountId, showArchived), [accountId, showArchived])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await addFriend({ ownerAccountId: accountId, displayName, email, phone, notes })
      setDisplayName("")
      setEmail("")
      setPhone("")
      setNotes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add friend.")
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
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" className="sm:col-span-2 w-fit">Add Friend</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(friends ?? []).map((friend) => (
          <Card key={friend.id} size="sm">
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
