import { useLiveQuery } from "dexie-react-hooks"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { db } from "@/lib/db"
import { budgetUtilization, formatINR } from "@/lib/money"
import {
  applyPaidSettlements,
  computeNetBalances,
  simplifyDebts,
} from "@/lib/settlement"
import { useAuthStore } from "@/stores/auth.store"
import { groupByCategory, groupByMonth, sumExpenses } from "@/features/expenses/expenses.db"
import { sumGroupExpenses } from "@/features/groups/groups.db"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function DashboardPage() {
  const userId = useAuthStore((s) => s.user?.userId)

  const data = useLiveQuery(async () => {
    if (!userId) return null

    const now = new Date()
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd")
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd")
    const yearStart = format(startOfYear(now), "yyyy-MM-dd")
    const yearEnd = format(endOfYear(now), "yyyy-MM-dd")

    const [personalExpenses, categories, groups, groupMembers, groupExpenses, settlements] =
      await Promise.all([
        db.personalExpenses.where("ownerUserId").equals(userId).toArray(),
        db.categories.toArray(),
        db.groups.filter((g) => !g.isArchived).toArray(),
        db.groupMembers.toArray(),
        db.groupExpenses.toArray(),
        db.settlements.filter((s) => s.status === "paid").toArray(),
      ])

    const myGroupIds = new Set(
      groupMembers.filter((m) => m.userId === userId).map((m) => m.groupId)
    )
    const myGroups = groups.filter((g) => myGroupIds.has(g.id))

    const monthExpenses = personalExpenses.filter(
      (e) => e.date >= monthStart && e.date <= monthEnd
    )
    const yearExpenses = personalExpenses.filter(
      (e) => e.date >= yearStart && e.date <= yearEnd
    )

    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
    const byCategory = groupByCategory(monthExpenses)
    const pieData = Object.entries(byCategory).map(([id, value]) => ({
      name: categoryMap[id] ?? "Unknown",
      value: value / 100,
    }))

    const byMonth = groupByMonth(personalExpenses)
    const barData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, value]) => ({ month, amount: value / 100 }))

    const trendData = personalExpenses
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map((e) => ({ date: e.date.slice(5), amount: e.amountPaise / 100 }))

    let outstandingSettlements = 0
    for (const group of myGroups) {
      const members = groupMembers.filter((m) => m.groupId === group.id && m.isActive)
      const expenses = groupExpenses.filter((e) => e.groupId === group.id)
      const paid = settlements.filter((s) => s.groupId === group.id)
      const balances = computeNetBalances(expenses, members)
      const debts = simplifyDebts(balances)
      const remaining = applyPaidSettlements(debts, paid)
      outstandingSettlements += remaining.reduce((s, d) => s + d.amountPaise, 0)
    }

    const groupSpending = myGroups.map((g) => {
      const expenses = groupExpenses.filter((e) => e.groupId === g.id)
      const spent = sumGroupExpenses(expenses)
      return {
        name: g.name,
        spent: spent / 100,
        budget: g.budgetPaise ? g.budgetPaise / 100 : null,
        utilization: budgetUtilization(spent, g.budgetPaise),
      }
    })

    const topCategory = pieData.length
      ? pieData.reduce((a, b) => (b.value > a.value ? b : a))
      : null

    return {
      monthTotal: sumExpenses(monthExpenses),
      yearTotal: sumExpenses(yearExpenses),
      groupCount: myGroups.length,
      groupExpenseTotal: sumGroupExpenses(
        groupExpenses.filter((e) => myGroupIds.has(e.groupId))
      ),
      outstandingSettlements,
      pieData,
      barData,
      trendData,
      groupSpending,
      topCategory,
    }
  }, [userId])

  if (!data) {
    return <p className="text-muted-foreground">Loading dashboard...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Your spending overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="This Month" value={formatINR(data.monthTotal)} />
        <StatCard title="This Year" value={formatINR(data.yearTotal)} />
        <StatCard title="Groups" value={String(data.groupCount)} />
        <StatCard
          title="Outstanding Settlements"
          value={formatINR(data.outstandingSettlements)}
        />
      </div>

      {data.topCategory && (
        <Card>
          <CardHeader>
            <CardTitle>Highest Spending Category</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {data.topCategory.name} — ₹{data.topCategory.value.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Category Breakdown" description="This month">
          {data.pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {data.pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Monthly Spending" description="Last 6 months">
          {data.barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
                <Bar dataKey="amount" fill="var(--chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Expense Trend" description="Recent personal expenses">
        {data.trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
              <Line type="monotone" dataKey="amount" stroke="var(--chart-3)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      {data.groupSpending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Group Budgets</CardTitle>
            <CardDescription>Budget vs actual spend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.groupSpending.map((g) => (
              <div key={g.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span>
                    ₹{g.spent.toFixed(2)}
                    {g.budget != null && ` / ₹${g.budget.toFixed(2)}`}
                  </span>
                </div>
                {g.budget != null && <Progress value={g.utilization} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <p className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
      No data yet
    </p>
  )
}
