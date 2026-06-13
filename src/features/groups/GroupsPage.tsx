import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { budgetUtilization, formatINR, parseINR } from "@/lib/money"
import { getAccountId, type Group, type GroupStatus } from "@/lib/db"
import { statusLabel } from "@/lib/group-guards"
import { useAuthStore } from "@/stores/auth.store"
import {
  addGroup,
  archiveGroup,
  deleteGroup,
  getArchivedGroups,
  getGroupsForAccount,
  restoreGroup,
  sumGroupExpenses,
  updateGroup,
} from "@/features/groups/groups.db"
import { getGroupTransactions } from "@/features/transactions/transactions.db"

const PAGE_SIZE = 6

export function GroupsPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = (searchParams.get("status") as GroupStatus | "all" | "archived") ?? "all"
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [confirm, setConfirm] = useState<{ type: "archive" | "delete" | "restore"; group: Group } | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [budget, setBudget] = useState("")
  const [error, setError] = useState<string | null>(null)

  const groupsData = useLiveQuery(async () => {
    const groups =
      statusFilter === "archived"
        ? await getArchivedGroups(accountId)
        : await getGroupsForAccount(accountId, statusFilter === "all" ? undefined : statusFilter)

    const spending = await Promise.all(
      groups.map(async (g) => {
        const transactions = await getGroupTransactions(g.id)
        return { groupId: g.id, spent: sumGroupExpenses(transactions) }
      })
    )
    const spentMap = Object.fromEntries(spending.map((s) => [s.groupId, s.spent]))
    return groups.map((g) => ({ ...g, spentPaise: spentMap[g.id] ?? 0 }))
  }, [accountId, statusFilter])

  const pagedGroups = useMemo(() => {
    if (!groupsData) return []
    const start = page * PAGE_SIZE
    return groupsData.slice(start, start + PAGE_SIZE)
  }, [groupsData, page])

  const totalPages = groupsData ? Math.ceil(groupsData.length / PAGE_SIZE) : 0

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
      createdByAccountId: accountId,
      creatorDisplayName: user.displayName,
    })
    setName("")
    setDescription("")
    setBudget("")
    setShowForm(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editGroup) return
    await updateGroup(editGroup.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      budgetPaise: budget ? parseINR(budget) : undefined,
    })
    setEditGroup(null)
  }

  async function handleConfirmAction() {
    if (!confirm) return
    if (confirm.type === "archive") await archiveGroup(confirm.group.id)
    if (confirm.type === "delete") await deleteGroup(confirm.group.id)
    if (confirm.type === "restore") await restoreGroup(confirm.group.id)
    setConfirm(null)
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

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "settlement_in_progress", "settled", "archived"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => {
              setSearchParams(s === "all" ? {} : { status: s })
              setPage(0)
            }}
          >
            {s === "all" ? "Active" : statusLabel(s)}
          </Button>
        ))}
      </div>

      {(showForm || editGroup) && (
        <Card>
          <CardHeader>
            <CardTitle>{editGroup ? "Edit Group" : "New Group"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={editGroup ? handleUpdate : handleCreate} className="grid gap-3 sm:grid-cols-2">
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
                <Button type="submit">{editGroup ? "Save" : "Create"}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditGroup(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {!groupsData ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : pagedGroups.length === 0 ? (
          <p className="text-muted-foreground">No groups in this view.</p>
        ) : (
          pagedGroups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>
                      <Link to={`/groups/${group.id}`} className="hover:text-primary">
                        {group.name}
                      </Link>
                    </CardTitle>
                    <Badge variant="outline" className="mt-1">
                      {statusLabel(group.status)}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    {group.status !== "archived" && group.status !== "settled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditGroup(group)
                          setName(group.name)
                          setDescription(group.description ?? "")
                          setBudget(group.budgetPaise ? String(group.budgetPaise / 100) : "")
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {group.status === "archived" ? (
                      <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: "restore", group })}>
                        Restore
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: "archive", group })}>
                        Archive
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: "delete", group })}>
                      Delete
                    </Button>
                  </div>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <ConfirmationModal
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.type === "delete"
            ? "Delete group?"
            : confirm?.type === "archive"
              ? "Archive group?"
              : "Restore group?"
        }
        description={
          confirm?.type === "delete"
            ? "This will permanently delete the group and all its transactions."
            : confirm?.type === "archive"
              ? "The group will be hidden from active lists but can be restored later."
              : "This group will return to your active list."
        }
        confirmLabel={confirm?.type === "delete" ? "Delete" : confirm?.type === "archive" ? "Archive" : "Restore"}
        variant={confirm?.type === "delete" ? "destructive" : "default"}
        onConfirm={handleConfirmAction}
      />
    </div>
  )
}
