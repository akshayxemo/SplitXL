import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { DateTimePickerModal, formatDateTime, isoToDateString } from "@/components/DateTimePickerModal"
import { db, getAccountId } from "@/lib/db"
import { formatINR, parseINR } from "@/lib/money"
import { useAuthStore } from "@/stores/auth.store"
import { getCategoriesForUser } from "@/features/categories/categories.db"
import {
  addPersonalExpense,
  deletePersonalExpense,
  updatePersonalExpense,
  type ExpenseFilters,
} from "@/features/expenses/expenses.db"
import { formatCategoryLabel } from "@/features/categories/categories.db"

const emptyForm = {
  title: "",
  amount: "",
  categoryId: "",
  notes: "",
}

export function ExpensesPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [transactionDateTime, setTransactionDateTime] = useState(new Date().toISOString())

  const categories = useLiveQuery(() => getCategoriesForUser(accountId), [accountId])

  const expenses = useLiveQuery(async () => {
    let list = await db.personalExpenses.where("ownerAccountId").equals(accountId).toArray()

    if (filters.categoryId) list = list.filter((e) => e.categoryId === filters.categoryId)
    if (filters.month) {
      const [y, m] = filters.month.split("-").map(Number)
      const start = `${y}-${String(m).padStart(2, "0")}-01`
      const endDay = new Date(y, m, 0).getDate()
      const end = `${y}-${String(m).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`
      list = list.filter((e) => e.date >= start && e.date <= end)
    }
    if (filters.year) list = list.filter((e) => e.date.startsWith(`${filters.year}-`))
    if (filters.startDate) list = list.filter((e) => e.date >= filters.startDate!)
    if (filters.endDate) list = list.filter((e) => e.date <= filters.endDate!)

    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [accountId, filters])

  const categoryMap = Object.fromEntries((categories ?? []).map((c) => [c.id, formatCategoryLabel(c)]))
  const total = (expenses ?? []).reduce((s, e) => s + e.amountPaise, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError("Title is required.")
      return
    }
    if (!form.categoryId) {
      setError("Category is required.")
      return
    }

    const amountPaise = parseINR(form.amount)
    if (amountPaise <= 0) {
      setError("Enter a valid amount.")
      return
    }

    try {
      if (editId) {
        await updatePersonalExpense(editId, {
          title: form.title.trim(),
          amountPaise,
          categoryId: form.categoryId,
          date: isoToDateString(transactionDateTime),
          transactionDateTime,
          notes: form.notes.trim() || undefined,
        })
      } else {
        await addPersonalExpense({
          ownerAccountId: accountId,
          title: form.title.trim(),
          amountPaise,
          categoryId: form.categoryId,
          date: isoToDateString(transactionDateTime),
          transactionDateTime,
          notes: form.notes.trim() || undefined,
        })
      }
      setForm(emptyForm)
      setEditId(null)
      setShowForm(false)
    } catch {
      setError("Failed to save expense.")
    }
  }

  function startEdit(expense: NonNullable<typeof expenses>[number]) {
    setEditId(expense.id)
    setForm({
      title: expense.title,
      amount: (expense.amountPaise / 100).toFixed(2),
      categoryId: expense.categoryId,
      notes: expense.notes ?? "",
    })
    setTransactionDateTime(expense.transactionDateTime)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Personal Expenses</h1>
          <p className="text-muted-foreground">Total: {formatINR(total)}</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm) }}>
          Add Expense
        </Button>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Category</Label>
            <Select
              value={filters.categoryId ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, categoryId: e.target.value || undefined }))
              }
            >
              <option value="">All</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{formatCategoryLabel(c)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Month</Label>
            <Input
              type="month"
              value={filters.month ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value || undefined }))}
            />
          </div>
          <div>
            <Label>Year</Label>
            <Input
              type="number"
              placeholder="2025"
              value={filters.year ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value || undefined }))}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setFilters({})}>Clear</Button>
          </div>
          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={filters.startDate ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
            />
          </div>
          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={filters.endDate ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
            />
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? "Edit Expense" : "New Expense"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Select...</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{formatCategoryLabel(c)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Date & Time</Label>
            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setShowDateTimePicker(true)}>
              {formatDateTime(transactionDateTime)}
            </Button>
          </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">{editId ? "Update" : "Save"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {!expenses ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : expenses.length === 0 ? (
          <p className="text-muted-foreground">No expenses found.</p>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} size="sm">
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{expense.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.date} · {categoryMap[expense.categoryId] ?? "Unknown"}
                  </p>
                  {expense.notes && <p className="text-xs text-muted-foreground">{expense.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{formatINR(expense.amountPaise)}</Badge>
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(expense)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(expense.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmationModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete expense?"
        description="This expense will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteId) await deletePersonalExpense(deleteId)
          setDeleteId(null)
        }}
      />

      <DateTimePickerModal
        open={showDateTimePicker}
        onOpenChange={setShowDateTimePicker}
        value={transactionDateTime}
        onChange={setTransactionDateTime}
      />
    </div>
  )
}
