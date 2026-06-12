import { useState } from "react"
import { Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { budgetUtilization, formatINR, parseINR } from "@/lib/money"
import { useAuthStore } from "@/stores/auth.store"
import { getActiveGroups, addGroup, archiveGroup, sumGroupExpenses } from "@/features/groups/groups.db"
import { db } from "@/lib/db"

export function GroupsPage() {
  const user = useAuthStore((s) => s.user)!
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [budget, setBudget] = useState("")
  const [error, setError] = useState<string | null>(null)

  const groupsData = useLiveQuery(async () => {
    const groups = await getActiveGroups(user.userId)
    const spending = await Promise.all(
      groups.map(async (g) => {
        const expenses = await db.groupExpenses.where("groupId").equals(g.id).toArray()
        return { groupId: g.id, spent: sumGroupExpenses(expenses) }
      })
    )
    const spentMap = Object.fromEntries(spending.map((s) => [s.groupId, s.spent]))
    return groups.map((g) => ({ ...g, spentPaise: spentMap[g.id] ?? 0 }))
  }, [user.userId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Group name is required.")
      return
    }
    setError(null)
    await addGroup({
      name,
      description,
      budgetPaise: budget ? parseINR(budget) : undefined,
      createdByUserId: user.userId,
      creatorDisplayName: user.displayName,
    })
    setName("")
    setDescription("")
    setBudget("")
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="text-muted-foreground">Split expenses with others</p>
        </div>
        <Button onClick={() => setShowForm(true)}>Create Group</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Group</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Budget (₹, optional)</Label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Create</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {!groupsData ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : groupsData.length === 0 ? (
          <p className="text-muted-foreground">No groups yet.</p>
        ) : (
          groupsData.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>
                    <Link to={`/groups/${group.id}`} className="hover:text-primary">
                      {group.name}
                    </Link>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => archiveGroup(group.id)}>
                    Archive
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
                <Badge>{formatINR(group.spentPaise)} spent</Badge>
                {group.budgetPaise != null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Budget</span>
                      <span>
                        {formatINR(group.spentPaise)} / {formatINR(group.budgetPaise)}
                      </span>
                    </div>
                    <Progress value={budgetUtilization(group.spentPaise, group.budgetPaise)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
