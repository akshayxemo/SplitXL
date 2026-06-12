import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { ArrowLeft, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { db, type SplitData } from "@/lib/db"
import { budgetUtilization, formatINR, parseINR } from "@/lib/money"
import { useAuthStore } from "@/stores/auth.store"
import { getCategoriesForUser } from "@/features/categories/categories.db"
import {
  addGroupExpense,
  addGroupMember,
  deleteGroupExpense,
  getGroupExpenses,
  getGroupMembers,
  removeGroupMember,
  sumGroupExpenses,
} from "@/features/groups/groups.db"
import { SettlementsPanel } from "@/features/settlements/SettlementsPanel"

type SplitMode = SplitData["method"]

export function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)!
  const [tab, setTab] = useState<"expenses" | "members" | "settlements">("expenses")
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [memberName, setMemberName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const emptyExpenseForm = {
    title: "",
    amount: "",
    categoryId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    paidByUserId: user.userId,
    splitMode: "equal_all" as SplitMode,
    selectedMembers: [] as string[],
    manualShares: {} as Record<string, string>,
    percentageShares: {} as Record<string, string>,
  };

  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);

  const data = useLiveQuery(async () => {
    if (!groupId) return null
    const [group, members, expenses] = await Promise.all([
      db.groups.get(groupId),
      getGroupMembers(groupId),
      getGroupExpenses(groupId),
    ])
    return { group, members, expenses, spent: sumGroupExpenses(expenses) }
  }, [groupId])

  const categories = useLiveQuery(
    () => (groupId ? getCategoriesForUser(user.userId, groupId) : []),
    [user.userId, groupId]
  )

  if (!groupId || !data) return <p className="text-muted-foreground">Loading...</p>
  if (!data.group) return <p className="text-destructive">Group not found.</p>

  const currentGroupId = groupId

  const activeMembers = data.members.filter((m) => m.isActive)
  const categoryMap = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))

  function buildSplitData(): SplitData {
    switch (expenseForm.splitMode) {
      case "equal_all":
        return { method: "equal_all" }
      case "equal_selected":
        return { method: "equal_selected", memberIds: expenseForm.selectedMembers }
      case "manual": {
        const shares: Record<string, number> = {}
        for (const [uid, val] of Object.entries(expenseForm.manualShares)) {
          shares[uid] = parseINR(val)
        }
        return { method: "manual", shares }
      }
      case "percentage": {
        const shares: Record<string, number> = {}
        for (const [uid, val] of Object.entries(expenseForm.percentageShares)) {
          shares[uid] = Number.parseFloat(val) || 0
        }
        return { method: "percentage", shares }
      }
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountPaise = parseINR(expenseForm.amount)
    if (!expenseForm.title.trim() || amountPaise <= 0 || !expenseForm.categoryId) {
      setError("Fill in title, amount, and category.")
      return
    }
    try {
      await addGroupExpense({
        groupId: currentGroupId,
        title: expenseForm.title,
        amountPaise,
        categoryId: expenseForm.categoryId,
        date: expenseForm.date,
        notes: expenseForm.notes,
        paidByUserId: expenseForm.paidByUserId,
        splitData: buildSplitData(),
      })
      setShowExpenseForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add expense.")
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!memberName.trim()) return
    await addGroupMember({ groupId: currentGroupId, displayName: memberName })
    setMemberName("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/groups"
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{data.group.name}</h1>
          {data.group.description && (
            <p className="text-muted-foreground">{data.group.description}</p>
          )}
        </div>
      </div>

      <Card size="sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="text-lg font-semibold">{formatINR(data.spent)}</p>
            </div>
            {data.group.budgetPaise != null && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Budget</span>
                  <span>{formatINR(data.group.budgetPaise)}</span>
                </div>
                <Progress value={budgetUtilization(data.spent, data.group.budgetPaise)} />
                {data.spent > data.group.budgetPaise && (
                  <p className="text-xs text-destructive mt-1">
                    Over budget by {formatINR(data.spent - data.group.budgetPaise)}
                  </p>
                )}
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

      {tab === "expenses" && (
        <div className="space-y-4">
          <Button onClick={() => {
            setShowExpenseForm(true);
            setExpenseForm(emptyExpenseForm);
          }}>Add Group Expense</Button>

          {showExpenseForm && (
            <Card>
              <CardHeader><CardTitle>New Expense</CardTitle></CardHeader>
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
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Paid By</Label>
                    <Select value={expenseForm.paidByUserId} onChange={(e) => setExpenseForm({ ...expenseForm, paidByUserId: e.target.value })}>
                      {activeMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.displayName}</option>
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
                        <label key={m.userId} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={expenseForm.selectedMembers.includes(m.userId)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...expenseForm.selectedMembers, m.userId]
                                : expenseForm.selectedMembers.filter((id) => id !== m.userId)
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
                        <div key={m.userId}>
                          <Label>{m.displayName} (₹)</Label>
                          <Input
                            value={expenseForm.manualShares[m.userId] ?? ""}
                            onChange={(e) =>
                              setExpenseForm({
                                ...expenseForm,
                                manualShares: { ...expenseForm.manualShares, [m.userId]: e.target.value },
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
                        <div key={m.userId}>
                          <Label>{m.displayName} (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={expenseForm.percentageShares[m.userId] ?? ""}
                            onChange={(e) =>
                              setExpenseForm({
                                ...expenseForm,
                                percentageShares: { ...expenseForm.percentageShares, [m.userId]: e.target.value },
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

                  {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {data.expenses.map((expense) => (
            <Card key={expense.id} size="sm">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{expense.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.date} · {categoryMap[expense.categoryId]} · {expense.splitMethod.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{formatINR(expense.amountPaise)}</Badge>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteGroupExpense(expense.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          <form onSubmit={handleAddMember} className="flex gap-2">
            <Input placeholder="Member name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
          {activeMembers.map((m) => (
            <Card key={m.id} size="sm">
              <CardContent className="flex items-center justify-between py-4">
                <span>{m.displayName}</span>
                {m.userId !== user.userId && (
                  <Button variant="ghost" size="sm" onClick={() => removeGroupMember(m.id)}>Remove</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "settlements" && (
        <SettlementsPanel
          groupId={currentGroupId}
          members={activeMembers}
          expenses={data.expenses}
        />
      )}
    </div>
  )
}
