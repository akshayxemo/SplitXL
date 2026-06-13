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
import { computeNetBalances, computeSettlementProgress, computeShares, sumExpenseTransactions } from "@/lib/settlement"
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
      const memberPaid: Record<string, number> = {}
      const monthlySpend: Record<string, number> = {}

      for (const tx of expenseTx) {
        const month = tx.transactionDateTime.slice(0, 7)
        monthlySpend[month] = (monthlySpend[month] ?? 0) + tx.amountPaise
        if (tx.categoryId) categorySpend[tx.categoryId] = (categorySpend[tx.categoryId] ?? 0) + tx.amountPaise
        memberPaid[tx.paidByMemberId] = (memberPaid[tx.paidByMemberId] ?? 0) + tx.amountPaise
      }

      const balances = computeNetBalances(transactions, groupMembers)

      // Per-member: amount consumed (sum of shares across expense transactions)
      const memberConsumed: Record<string, number> = {}
      const memberExpenseCount: Record<string, number> = {}
      for (const tx of expenseTx) {
        const shares = computeShares(tx, groupMembers)
        for (const [memberId, share] of Object.entries(shares)) {
          if (share > 0) {
            memberConsumed[memberId] = (memberConsumed[memberId] ?? 0) + share
            memberExpenseCount[memberId] = (memberExpenseCount[memberId] ?? 0) + 1
          }
        }
      }

      const group = groups.find((g) => g.id === groupId)
      const spent = sumExpenseTransactions(transactions)
      const settlementProgress = computeSettlementProgress(transactions, groupMembers)

      // Build per-member stats
      const memberStats = groupMembers.map((m) => ({
        id: m.id,
        name: m.displayName,
        amountPaid: (memberPaid[m.id] ?? 0) / 100,
        amountConsumed: (memberConsumed[m.id] ?? 0) / 100,
        netPosition: (balances[m.id] ?? 0) / 100,
        expenseCount: memberExpenseCount[m.id] ?? 0,
      }))

      groupInsights = {
        categoryPie: Object.entries(categorySpend).map(([id, val]) => ({
          name: categoryMap[id] ?? "Unknown",
          value: val / 100,
        })),
        memberStats,
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
            <InsightChart
              title="Category Breakdown"
              description={`Last ${dateRangeMonths} months · Total spend per category`}
              data={insights.personalByCategory}
              type="pie"
            />
            <InsightChart
              title="Monthly Spending"
              description={`Last ${dateRangeMonths} months · Total personal expenses per month`}
              data={insights.personalByMonth.map((d) => ({ name: d.month, amount: d.amount }))}
              type="bar"
              dataKey="amount"
            />
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
              </div>

              {/* Settlement Progress Breakdown */}
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Settlement Progress</CardTitle>
                  <CardDescription>
                    Settled Amount ÷ Total Debt · All time
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatBox
                    label="Total Debt"
                    value={`₹${(insights.groupInsights.settlementProgress.totalDebt / 100).toFixed(2)}`}
                  />
                  <StatBox
                    label="Settled Amount"
                    value={`₹${(insights.groupInsights.settlementProgress.settledAmount / 100).toFixed(2)}`}
                  />
                  <StatBox
                    label="Remaining Amount"
                    value={`₹${(insights.groupInsights.settlementProgress.remainingAmount / 100).toFixed(2)}`}
                  />
                  <StatBox
                    label="Completion"
                    value={`${insights.groupInsights.settlementProgress.completionPct.toFixed(0)}%`}
                  />
                </CardContent>
              </Card>

              {/* Per-Member Metrics */}
              <div>
                <p className="text-sm font-medium mb-1">Member Contributions · All time</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Amount Paid = money paid for expenses · Amount Consumed = member's share of expenses ·
                  Net Position = positive means owed money, negative means owes money
                </p>
                <div className="space-y-3">
                  {insights.groupInsights.memberStats.map((m) => (
                    <Card key={m.id} className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{m.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <StatBox label="Amount Paid" value={`₹${m.amountPaid.toFixed(2)}`} />
                        <StatBox label="Amount Consumed" value={`₹${m.amountConsumed.toFixed(2)}`} />
                        <StatBox
                          label="Net Position"
                          value={`${m.netPosition >= 0 ? "+" : ""}₹${m.netPosition.toFixed(2)}`}
                        />
                        <StatBox label="Expense Count" value={String(m.expenseCount)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <InsightChart
                  title="Category Spending"
                  description={`Last ${dateRangeMonths} months · Total amount per category`}
                  data={insights.groupInsights.categoryPie}
                  type="pie"
                />
                <InsightChart
                  title="Monthly Spending"
                  description="All time · Total group expenses per month"
                  data={insights.groupInsights.monthlyBar.map((d) => ({ name: d.month, amount: d.amount }))}
                  type="bar"
                  dataKey="amount"
                />
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
  description,
  data,
  type,
  dataKey = "value",
}: {
  title: string
  description?: string
  data: { name: string; value?: number; amount?: number }[]
  type: "pie" | "bar"
  dataKey?: string
}) {
  if (data.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium mb-1">{title}</p>
        {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
        <p className="text-sm text-muted-foreground h-[200px] flex items-center justify-center">No data</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
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
