import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { format, subMonths } from "date-fns"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { db, getAccountId } from "@/lib/db"
import { formatINR } from "@/lib/money"
import { computeNetBalances, simplifyDebts, sumExpenseTransactions } from "@/lib/settlement"
import { useAuthStore } from "@/stores/auth.store"
import { groupByCategory, groupByMonth, sumExpenses } from "@/features/expenses/expenses.db"
import { getGroupsForAccount } from "@/features/groups/groups.db"

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function InsightsPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [dateRangeMonths, setDateRangeMonths] = useState("6")

  const insights = useLiveQuery(async () => {
    const [personalExpenses, categories, groups, members, allTransactions] = await Promise.all([
      db.personalExpenses.where("ownerAccountId").equals(accountId).toArray(),
      db.categories.toArray(),
      getGroupsForAccount(accountId, "all"),
      db.groupMembers.toArray(),
      db.transactions.toArray(),
    ])

    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.id, `${c.emoji ?? "📁"} ${c.name}`])
    )

    const monthsBack = Number.parseInt(dateRangeMonths, 10)
    const cutoff = format(subMonths(new Date(), monthsBack), "yyyy-MM-dd")
    const filteredPersonal = personalExpenses.filter((e) => e.date >= cutoff)

    const personalByCategory = Object.entries(groupByCategory(filteredPersonal)).map(([id, val]) => ({
      name: categoryMap[id] ?? "Unknown",
      value: val / 100,
    }))

    const personalByMonth = Object.entries(groupByMonth(filteredPersonal))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, val]) => ({ month, amount: val / 100 }))

    const groupId = selectedGroupId || groups.find((g) => g.status !== "archived")?.id
    let groupInsights = null
    if (groupId) {
      const groupMembers = members.filter((m) => m.groupId === groupId && m.isActive)
      const transactions = allTransactions.filter((t) => t.groupId === groupId)
      const expenseTx = transactions.filter((t) => t.type === "expense")

      const categorySpend: Record<string, number> = {}
      const memberSpend: Record<string, number> = {}
      const memberPaid: Record<string, number> = {}
      const monthlySpend: Record<string, number> = {}

      for (const tx of expenseTx) {
        const month = tx.transactionDateTime.slice(0, 7)
        monthlySpend[month] = (monthlySpend[month] ?? 0) + tx.amountPaise
        if (tx.categoryId) categorySpend[tx.categoryId] = (categorySpend[tx.categoryId] ?? 0) + tx.amountPaise
        memberPaid[tx.paidByMemberId] = (memberPaid[tx.paidByMemberId] ?? 0) + tx.amountPaise
      }

      const balances = computeNetBalances(transactions, groupMembers)
      for (const [memberId, balance] of Object.entries(balances)) {
        if (balance < 0) memberSpend[memberId] = -balance
      }

      const group = groups.find((g) => g.id === groupId)
      const spent = sumExpenseTransactions(transactions)
      const debts = simplifyDebts(balances)
      const settlementTotal = debts.reduce((s, d) => s + d.amountPaise, 0)
      const settlementProgress =
        settlementTotal === 0 ? 100 : Math.max(0, 100 - (settlementTotal / Math.max(spent, 1)) * 100)

      groupInsights = {
        categoryPie: Object.entries(categorySpend).map(([id, val]) => ({
          name: categoryMap[id] ?? "Unknown",
          value: val / 100,
        })),
        memberContribution: Object.entries(memberPaid).map(([id, val]) => ({
          name: groupMembers.find((m) => m.id === id)?.displayName ?? id,
          value: val / 100,
        })),
        memberSpending: Object.entries(memberSpend).map(([id, val]) => ({
          name: groupMembers.find((m) => m.id === id)?.displayName ?? id,
          amount: val / 100,
        })),
        monthlyBar: Object.entries(monthlySpend)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, val]) => ({ month, amount: val / 100 })),
        budgetVsActual: {
          budget: group?.budgetPaise ? group.budgetPaise / 100 : null,
          actual: spent / 100,
        },
        settlementProgress,
      }
    }

    const refunds = allTransactions.filter((t) => t.type === "refund").length

    return {
      groups,
      personalMonthlySpend: sumExpenses(filteredPersonal) / 100,
      personalByCategory,
      personalByMonth,
      refundCount: refunds,
      groupInsights,
    }
  }, [accountId, selectedGroupId, dateRangeMonths])

  if (!insights) return <p className="text-muted-foreground">Loading insights...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-muted-foreground">Personal and group analytics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <Label>Date range</Label>
              <Select value={dateRangeMonths} onChange={(e) => setDateRangeMonths(e.target.value)} className="bg-background">
                <option value="3">Last 3 months</option>
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
              </Select>
            </div>
          </div>
          <p className="text-lg font-semibold">Monthly spend total: ₹{insights.personalMonthlySpend.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Refunds recorded: {insights.refundCount}</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightChart title="Category Breakdown" data={insights.personalByCategory} type="pie" />
            <InsightChart title="Monthly Spending" data={insights.personalByMonth.map((d) => ({ name: d.month, amount: d.amount }))} type="bar" dataKey="amount" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Group Insights</CardTitle>
          <CardDescription>Scoped to selected group</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Group</Label>
            <Select
              value={selectedGroupId || insights.groups[0]?.id || ""}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-background"
            >
              {insights.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>

          {insights.groupInsights && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatBox
                  label="Budget vs Actual"
                  value={
                    insights.groupInsights.budgetVsActual.budget != null
                      ? `₹${insights.groupInsights.budgetVsActual.actual.toFixed(2)} / ₹${insights.groupInsights.budgetVsActual.budget.toFixed(2)}`
                      : `₹${insights.groupInsights.budgetVsActual.actual.toFixed(2)} (no budget)`
                  }
                />
                <StatBox
                  label="Settlement Progress"
                  value={`${insights.groupInsights.settlementProgress.toFixed(0)}%`}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <InsightChart title="Category Spending" data={insights.groupInsights.categoryPie} type="pie" />
                <InsightChart title="Member Contributions" data={insights.groupInsights.memberContribution} type="pie" />
                <InsightChart title="Member Spending" data={insights.groupInsights.memberSpending} type="bar" dataKey="amount" />
                <InsightChart title="Monthly Spending" data={insights.groupInsights.monthlyBar.map((d) => ({ name: d.month, amount: d.amount }))} type="bar" dataKey="amount" />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function InsightChart({
  title,
  data,
  type,
  dataKey = "value",
}: {
  title: string
  data: { name: string; value?: number; amount?: number }[]
  type: "pie" | "bar"
  dataKey?: string
}) {
  if (data.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium mb-2">{title}</p>
        <p className="text-sm text-muted-foreground h-[200px] flex items-center justify-center">No data</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        {type === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey={dataKey} nameKey="name" cx="50%" cy="50%" outerRadius={70}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatINR(Number(v) * 100)} />
            <Legend />
          </PieChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
            <Bar dataKey={dataKey} fill="var(--chart-2)" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
