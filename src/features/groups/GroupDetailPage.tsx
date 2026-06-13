import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { DateTimePickerModal, formatDateTime } from "@/components/DateTimePickerModal"
import { TransactionTimeline } from "@/components/TransactionTimeline"
import { db, getAccountId, type SplitData } from "@/lib/db"
import { isGroupLocked, statusLabel } from "@/lib/group-guards"
import { budgetUtilization, formatINR, parseINR } from "@/lib/money"
import { useAuthStore } from "@/stores/auth.store"
import { formatCategoryLabel, getCategoriesForUser } from "@/features/categories/categories.db"
import {
  addGroupExpense,
  addGroupMember,
  addGroupMemberFromFriend,
  deleteGroupExpense,
  getGroupMembers,
  removeGroupMember,
  sumGroupExpenses,
  updateGroupExpense,
  updateGroupMember,
} from "@/features/groups/groups.db"
import { getFriends } from "@/features/friends/friends.db"
import { getGroupTransactions } from "@/features/transactions/transactions.db"
import { SettlementsPanel } from "@/features/settlements/SettlementsPanel"

type SplitMode = SplitData["method"]
type MemberAddMode = "friend" | "new" | "save_friend"

export function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [tab, setTab] = useState<"expenses" | "members" | "settlements">("expenses")
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [memberMode, setMemberMode] = useState<MemberAddMode>("new")
  const [memberName, setMemberName] = useState("")
  const [memberEmail, setMemberEmail] = useState("")
  const [memberPhone, setMemberPhone] = useState("")
  const [selectedFriendId, setSelectedFriendId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [editingTxId, setEditingTxId] = useState<string | null>(null)

  // Member view/edit/remove state
  const [viewMemberId, setViewMemberId] = useState<string | null>(null)
  const [editMemberId, setEditMemberId] = useState<string | null>(null)
  const [editMemberName, setEditMemberName] = useState("")
  const [editMemberEmail, setEditMemberEmail] = useState("")
  const [editMemberPhone, setEditMemberPhone] = useState("")
  const [editMemberError, setEditMemberError] = useState<string | null>(null)
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)

  const emptyExpenseForm = {
    title: "",
    amount: "",
    categoryId: "",
    transactionDateTime: new Date().toISOString(),
    notes: "",
    paidByMemberId: "",
    splitMode: "equal_all" as SplitMode,
    selectedMembers: [] as string[],
    manualShares: {} as Record<string, string>,
    percentageShares: {} as Record<string, string>,
  }

  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm)

  const data = useLiveQuery(async () => {
    if (!groupId) return null
    const [group, members, transactions] = await Promise.all([
      db.groups.get(groupId),
      getGroupMembers(groupId),
      getGroupTransactions(groupId),
    ])
    return { group, members, transactions, spent: sumGroupExpenses(transactions) }
  }, [groupId])

  const categories = useLiveQuery(
    () => (groupId ? getCategoriesForUser(accountId, groupId) : []),
    [accountId, groupId]
  )

  const friends = useLiveQuery(() => getFriends(accountId), [accountId])

  if (!groupId || !data) return <p className="text-muted-foreground">Loading...</p>
  if (!data.group) return <p className="text-destructive">Group not found.</p>

  const { group } = data
  const activeMembers = data.members.filter((m) => m.isActive)
  const locked = isGroupLocked(group)
  const creatorMember = activeMembers.find((m) => m.linkedAccountId === accountId)

  function buildSplitData(): SplitData {
    switch (expenseForm.splitMode) {
      case "equal_all":
        return { method: "equal_all" }
      case "equal_selected":
        return { method: "equal_selected", memberIds: expenseForm.selectedMembers }
      case "manual": {
        const shares: Record<string, number> = {}
        for (const [mid, val] of Object.entries(expenseForm.manualShares)) {
          shares[mid] = parseINR(val)
        }
        return { method: "manual", shares }
      }
      case "percentage": {
        const shares: Record<string, number> = {}
        for (const [mid, val] of Object.entries(expenseForm.percentageShares)) {
          shares[mid] = Number.parseFloat(val) || 0
        }
        return { method: "percentage", shares }
      }
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountPaise = parseINR(expenseForm.amount)
    const paidByMemberId = expenseForm.paidByMemberId || creatorMember?.id || activeMembers[0]?.id
    if (!expenseForm.title.trim() || amountPaise <= 0 || !expenseForm.categoryId || !paidByMemberId) {
      setError("Fill in title, amount, category, and payer.")
      return
    }
    try {
      const payload = {
        groupId: groupId!,
        title: expenseForm.title,
        amountPaise,
        categoryId: expenseForm.categoryId,
        transactionDateTime: expenseForm.transactionDateTime,
        notes: expenseForm.notes,
        paidByMemberId,
        splitData: buildSplitData(),
      }
      if (editingTxId) {
        await updateGroupExpense(editingTxId, payload)
        setEditingTxId(null)
      } else {
        await addGroupExpense(payload)
      }
      setShowExpenseForm(false)
      setExpenseForm(emptyExpenseForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense.")
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (memberMode === "friend") {
        if (!selectedFriendId) throw new Error("Select a friend.")
        await addGroupMemberFromFriend({ groupId: groupId!, friendId: selectedFriendId })
      } else {
        await addGroupMember({
          groupId: groupId!,
          displayName: memberName,
          email: memberEmail || undefined,
          phone: memberPhone || undefined,
          saveAsFriend: memberMode === "save_friend",
          ownerAccountId: accountId,
        })
      }
      setMemberName("")
      setMemberEmail("")
      setMemberPhone("")
      setSelectedFriendId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/groups" className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <div className="flex items-center gap-2">
            {group.description && <p className="text-muted-foreground">{group.description}</p>}
            <Badge variant="outline">{statusLabel(group.status)}</Badge>
          </div>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="text-lg font-semibold">{formatINR(data.spent)}</p>
            </div>
            {group.budgetPaise != null && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Budget</span>
                  <span>{formatINR(group.budgetPaise)}</span>
                </div>
                <Progress value={budgetUtilization(data.spent, group.budgetPaise)} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b border-border">
        {(["expenses", "members", "settlements"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {tab === "expenses" && (
        <div className="space-y-4">
          {!locked && group.status !== "archived" && (
            <Button
              onClick={() => {
                setShowExpenseForm(true)
                setEditingTxId(null)
                setExpenseForm({
                  ...emptyExpenseForm,
                  paidByMemberId: creatorMember?.id ?? "",
                })
              }}
            >
              Add Group Expense
            </Button>
          )}

          {showExpenseForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingTxId ? "Edit Expense" : "New Expense"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddExpense} className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Title</Label>
                    <Input value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={expenseForm.categoryId} onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}>
                      <option value="">Select...</option>
                      {(categories ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{formatCategoryLabel(c)}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Date & Time</Label>
                    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setShowDateTimePicker(true)}>
                      {formatDateTime(expenseForm.transactionDateTime)}
                    </Button>
                  </div>
                  <div>
                    <Label>Paid By</Label>
                    <Select
                      value={expenseForm.paidByMemberId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, paidByMemberId: e.target.value })}
                    >
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.displayName}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Split Method</Label>
                    <Select
                      value={expenseForm.splitMode}
                      onChange={(e) => setExpenseForm({ ...expenseForm, splitMode: e.target.value as SplitMode })}
                    >
                      <option value="equal_all">Equal (All Members)</option>
                      <option value="equal_selected">Equal (Selected)</option>
                      <option value="manual">Manual</option>
                      <option value="percentage">Percentage</option>
                    </Select>
                  </div>
                  {expenseForm.splitMode === "equal_selected" && (
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Select Members</Label>
                      {activeMembers.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={expenseForm.selectedMembers.includes(m.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...expenseForm.selectedMembers, m.id]
                                : expenseForm.selectedMembers.filter((id) => id !== m.id)
                              setExpenseForm({ ...expenseForm, selectedMembers: ids })
                            }}
                          />
                          {m.displayName}
                        </label>
                      ))}
                    </div>
                  )}
                  {expenseForm.splitMode === "manual" && (
                    <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                      {activeMembers.map((m) => (
                        <div key={m.id}>
                          <Label>{m.displayName} (₹)</Label>
                          <Input
                            value={expenseForm.manualShares[m.id] ?? ""}
                            onChange={(e) =>
                              setExpenseForm({
                                ...expenseForm,
                                manualShares: { ...expenseForm.manualShares, [m.id]: e.target.value },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {expenseForm.splitMode === "percentage" && (
                    <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                      {activeMembers.map((m) => (
                        <div key={m.id}>
                          <Label>{m.displayName} (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={expenseForm.percentageShares[m.id] ?? ""}
                            onChange={(e) =>
                              setExpenseForm({
                                ...expenseForm,
                                percentageShares: { ...expenseForm.percentageShares, [m.id]: e.target.value },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <TransactionTimeline
            transactions={data.transactions}
            members={activeMembers}
            categories={categories ?? []}
            groupReadOnly={locked || group.status === "archived" || group.status === "settled"}
            onEdit={(tx) => {
              setEditingTxId(tx.id)
              setShowExpenseForm(true)
              setExpenseForm({
                title: tx.title,
                amount: String(tx.amountPaise / 100),
                categoryId: tx.categoryId ?? "",
                transactionDateTime: tx.transactionDateTime,
                notes: tx.notes ?? "",
                paidByMemberId: tx.paidByMemberId,
                splitMode: tx.splitMethod ?? "equal_all",
                selectedMembers: tx.splitData?.method === "equal_selected" ? tx.splitData.memberIds : [],
                manualShares:
                  tx.splitData?.method === "manual"
                    ? Object.fromEntries(Object.entries(tx.splitData.shares).map(([k, v]) => [k, String(v / 100)]))
                    : {},
                percentageShares:
                  tx.splitData?.method === "percentage"
                    ? Object.fromEntries(Object.entries(tx.splitData.shares).map(([k, v]) => [k, String(v)]))
                    : {},
              })
            }}
            onDelete={(tx) => deleteGroupExpense(tx.id)}
          />
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          {!locked && group.status !== "archived" && (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleAddMember} className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(["friend", "new", "save_friend"] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        variant={memberMode === mode ? "default" : "outline"}
                        onClick={() => setMemberMode(mode)}
                      >
                        {mode === "friend" ? "Select Friend" : mode === "new" ? "New Member" : "New + Save as Friend"}
                      </Button>
                    ))}
                  </div>
                  {memberMode === "friend" ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-border p-2">
                      {(friends ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground px-2 py-1">No friends found. Add friends first.</p>
                      ) : (
                        (friends ?? []).map((f) => {
                          const contactLine = [f.email, f.phone].filter(Boolean).join(" · ")
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSelectedFriendId(f.id)}
                              className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors border ${
                                selectedFriendId === f.id
                                  ? "border-primary bg-primary/10"
                                  : "border-transparent hover:bg-muted"
                              }`}
                            >
                              <span className="font-medium">{f.displayName}</span>
                              {contactLine && (
                                <span className="block text-xs text-muted-foreground">{contactLine}</span>
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  ) : (
                    <>
                      <Input placeholder="Name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input placeholder="Email (optional)" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                        <Input placeholder="Phone (optional)" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} />
                      </div>
                    </>
                  )}
                  <Button type="submit">Add Member</Button>
                </form>
              </CardContent>
            </Card>
          )}
          {activeMembers.map((m) => {
            const linkedFriend = friends?.find((f) => f.id === m.linkedFriendId)
            return (
              <Card key={m.id} size="sm">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{m.displayName}</span>
                      {(m.email || m.phone) && (
                        <p className="text-xs text-muted-foreground">{[m.email, m.phone].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewMemberId(viewMemberId === m.id ? null : m.id)
                          setEditMemberId(null)
                        }}
                      >
                        {viewMemberId === m.id ? "Hide" : "View"}
                      </Button>
                      {!locked && group.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditMemberId(m.id)
                            setEditMemberName(m.displayName)
                            setEditMemberEmail(m.email ?? "")
                            setEditMemberPhone(m.phone ?? "")
                            setEditMemberError(null)
                            setViewMemberId(null)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {m.linkedAccountId !== accountId && !locked && group.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoveMemberId(m.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* View detail panel */}
                  {viewMemberId === m.id && editMemberId !== m.id && (
                    <div className="border-t border-border pt-3 grid gap-1 text-sm">
                      <div className="grid grid-cols-[120px_1fr] gap-1">
                        <span className="text-muted-foreground">Name</span>
                        <span>{m.displayName}</span>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] gap-1">
                        <span className="text-muted-foreground">Email</span>
                        <span>{m.email ?? <span className="italic text-muted-foreground">—</span>}</span>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] gap-1">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{m.phone ?? <span className="italic text-muted-foreground">—</span>}</span>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] gap-1">
                        <span className="text-muted-foreground">Linked Friend</span>
                        <span>
                          {linkedFriend
                            ? linkedFriend.displayName
                            : <span className="italic text-muted-foreground">Not linked</span>}
                        </span>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] gap-1">
                        <span className="text-muted-foreground">Added</span>
                        <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Inline edit form */}
                  {editMemberId === m.id && (
                    <form
                      className="border-t border-border pt-3 space-y-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        setEditMemberError(null)
                        try {
                          await updateGroupMember(m.id, {
                            displayName: editMemberName.trim(),
                            email: editMemberEmail.trim() || undefined,
                            phone: editMemberPhone.trim() || undefined,
                          })
                          setEditMemberId(null)
                        } catch (err) {
                          setEditMemberError(err instanceof Error ? err.message : "Failed to update member.")
                        }
                      }}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={editMemberName}
                            onChange={(e) => setEditMemberName(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input
                            value={editMemberEmail}
                            onChange={(e) => setEditMemberEmail(e.target.value)}
                            placeholder="optional"
                          />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input
                            value={editMemberPhone}
                            onChange={(e) => setEditMemberPhone(e.target.value)}
                            placeholder="optional"
                          />
                        </div>
                      </div>
                      {editMemberError && <p className="text-sm text-destructive">{editMemberError}</p>}
                      <div className="flex gap-2">
                        <Button type="submit" size="sm">Save</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditMemberId(null)}>Cancel</Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {tab === "settlements" && (
        <SettlementsPanel groupId={groupId} members={activeMembers} transactions={data.transactions} />
      )}

      <DateTimePickerModal
        open={showDateTimePicker}
        onOpenChange={setShowDateTimePicker}
        value={expenseForm.transactionDateTime}
        onChange={(iso) =>
          setExpenseForm({ ...expenseForm, transactionDateTime: iso })
        }
      />

      {/* Remove member confirmation modal */}
      <ConfirmationModal
        open={!!removeMemberId}
        onOpenChange={(open) => !open && setRemoveMemberId(null)}
        title="Remove member?"
        description="This will remove the member from the group. Their expenses will remain."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (removeMemberId) await removeGroupMember(removeMemberId)
          setRemoveMemberId(null)
        }}
      />
    </div>
  )
}
