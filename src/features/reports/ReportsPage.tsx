import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { pdf } from "@react-pdf/renderer"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { db, getAccountId } from "@/lib/db"
import { formatINR } from "@/lib/money"
import { useAuthStore } from "@/stores/auth.store"
import { formatCategoryLabel, getCategoryMap } from "@/features/categories/categories.db"
import { groupByCategory, sumExpenses } from "@/features/expenses/expenses.db"
import { getGroupsForAccount, sumGroupExpenses } from "@/features/groups/groups.db"
import { computeNetBalances, getMemberDisplayName, simplifyDebts } from "@/lib/settlement"
import { getGroupTransactions } from "@/features/transactions/transactions.db"
import { PersonalReportDocument } from "@/features/reports/PersonalReportDocument"
import { GroupReportDocument } from "@/features/reports/GroupReportDocument"

export function ReportsPage() {
  const user = useAuthStore((s) => s.user)!
  const accountId = getAccountId(user)
  const [reportType, setReportType] = useState<"personal" | "group">("personal")
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"))

  const groups = useLiveQuery(() => getGroupsForAccount(accountId), [accountId])

  const reportData = useLiveQuery(async () => {
    if (reportType === "personal") {
      const [y, m] = month.split("-").map(Number)
      const start = format(startOfMonth(new Date(y, m - 1)), "yyyy-MM-dd")
      const end = format(endOfMonth(new Date(y, m - 1)), "yyyy-MM-dd")

      const expenses = await db.personalExpenses
        .where("ownerAccountId")
        .equals(accountId)
        .filter((e) => e.date >= start && e.date <= end)
        .toArray()
      const categoryMap = await getCategoryMap()
      const byCategory = groupByCategory(expenses)
      const categoryBreakdown = Object.entries(byCategory).map(([id, amount]) => ({
        name: categoryMap[id] ? formatCategoryLabel(categoryMap[id]) : "Unknown",
        amount: formatINR(amount),
      }))
      return {
        type: "personal" as const,
        title: `Personal Report — ${month}`,
        total: formatINR(sumExpenses(expenses)),
        expenseCount: expenses.length,
        categoryBreakdown,
        expenses: expenses.map((e) => ({
          title: e.title,
          date: e.date,
          category: categoryMap[e.categoryId] ? formatCategoryLabel(categoryMap[e.categoryId]) : "Unknown",
          amount: formatINR(e.amountPaise),
        })),
      }
    }

    if (!selectedGroupId) return null

    const group = await db.groups.get(selectedGroupId)
    if (!group) return null

    const [members, transactions, categoryMap] = await Promise.all([
      db.groupMembers.where("groupId").equals(selectedGroupId).toArray(),
      getGroupTransactions(selectedGroupId),
      getCategoryMap(),
    ])

    const activeMembers = members.filter((m) => m.isActive)
    const balances = computeNetBalances(transactions, activeMembers)
    const outstanding = simplifyDebts(balances)

    const expenses = transactions.filter((t) => t.type === "expense")
    const refunds = transactions.filter((t) => t.type === "refund")
    const settlements = transactions.filter((t) => t.type === "settlement_payment")

    const categoryTotals: Record<string, number> = {}
    for (const e of expenses) {
      if (e.categoryId) categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] ?? 0) + e.amountPaise
    }

    return {
      type: "group" as const,
      title: `Group Report — ${group.name} (Full History)`,
      groupName: group.name,
      total: formatINR(sumGroupExpenses(transactions)),
      expenseCount: expenses.length,
      refundCount: refunds.length,
      budget: group.budgetPaise ? formatINR(group.budgetPaise) : "Not set",
      categoryBreakdown: Object.entries(categoryTotals).map(([id, amount]) => ({
        name: categoryMap[id] ? formatCategoryLabel(categoryMap[id]) : "Unknown",
        amount: formatINR(amount),
      })),
      settlements: outstanding.map((d) => ({
        from: getMemberDisplayName(activeMembers, d.fromMemberId),
        to: getMemberDisplayName(activeMembers, d.toMemberId),
        amount: formatINR(d.amountPaise),
      })),
      settlementHistory: settlements.map((s) => ({
        from: getMemberDisplayName(activeMembers, s.settlementFromMemberId ?? s.paidByMemberId),
        to: getMemberDisplayName(activeMembers, s.settlementToMemberId ?? ""),
        amount: formatINR(s.amountPaise),
        date: s.transactionDateTime.slice(0, 10),
      })),
      expenses: expenses.map((e) => ({
        title: e.title,
        date: e.transactionDateTime.slice(0, 10),
        amount: formatINR(e.amountPaise),
        paidBy: getMemberDisplayName(activeMembers, e.paidByMemberId),
        category: e.categoryId && categoryMap[e.categoryId] ? formatCategoryLabel(categoryMap[e.categoryId]) : "—",
      })),
      refunds: refunds.map((r) => ({
        title: r.title,
        date: r.transactionDateTime.slice(0, 10),
        amount: formatINR(r.amountPaise),
      })),
    }
  }, [reportType, selectedGroupId, month, accountId])

  async function downloadPdf() {
    if (!reportData) return
    const doc =
      reportData.type === "personal" ? (
        <PersonalReportDocument data={reportData} userName={user.displayName} />
      ) : (
        <GroupReportDocument data={reportData} />
      )
    const blob = await pdf(doc).toBlob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `splitxl-report-${reportType === "personal" ? month : selectedGroupId}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground">Generate and export spending reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="size-4" />
            Print
          </Button>
          <Button onClick={downloadPdf} disabled={!reportData}>
            <Download className="size-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-3">
          <div>
            <Label>Report Type</Label>
            <Select value={reportType} onChange={(e) => setReportType(e.target.value as "personal" | "group")} className="bg-background">
              <option value="personal">Personal</option>
              <option value="group">Group (Full History)</option>
            </Select>
          </div>
          {reportType === "personal" && (
            <div>
              <Label>Month</Label>
              <input
                type="month"
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          )}
          {reportType === "group" && (
            <div>
              <Label>Group</Label>
              <Select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="bg-background">
                <option value="">Select group...</option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div id="report-preview" className="print:block">
        {!reportData ? (
          <p className="text-muted-foreground">Select options to preview report.</p>
        ) : reportData.type === "personal" ? (
          <Card>
            <CardHeader>
              <CardTitle>{reportData.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>User: {user.displayName}</p>
              <p>Total: {reportData.total} ({reportData.expenseCount} expenses)</p>
              <div>
                <h3 className="font-medium mb-2">Category Breakdown</h3>
                {reportData.categoryBreakdown.map((c) => (
                  <p key={c.name} className="text-sm">{c.name}: {c.amount}</p>
                ))}
              </div>
              <div>
                <h3 className="font-medium mb-2">Expenses</h3>
                {reportData.expenses.map((e, i) => (
                  <p key={i} className="text-sm">{e.date} — {e.title} ({e.category}): {e.amount}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{reportData.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Total: {reportData.total} · Budget: {reportData.budget}</p>
              <p>{reportData.expenseCount} expenses · {reportData.refundCount} refunds</p>
              <div>
                <h3 className="font-medium mb-2">Category Analysis</h3>
                {reportData.categoryBreakdown.map((c) => (
                  <p key={c.name} className="text-sm">{c.name}: {c.amount}</p>
                ))}
              </div>
              <div>
                <h3 className="font-medium mb-2">Outstanding Settlements</h3>
                {reportData.settlements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All settled</p>
                ) : (
                  reportData.settlements.map((s, i) => (
                    <p key={i} className="text-sm">{s.from} owes {s.to}: {s.amount}</p>
                  ))
                )}
              </div>
              <div>
                <h3 className="font-medium mb-2">Settlement History</h3>
                {reportData.settlementHistory.map((s, i) => (
                  <p key={i} className="text-sm">{s.date}: {s.from} → {s.to}: {s.amount}</p>
                ))}
              </div>
              <div>
                <h3 className="font-medium mb-2">Expenses</h3>
                {reportData.expenses.map((e, i) => (
                  <p key={i} className="text-sm">{e.date} — {e.title} ({e.category}, paid by {e.paidBy}): {e.amount}</p>
                ))}
              </div>
              {reportData.refunds.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Refunds</h3>
                  {reportData.refunds.map((r, i) => (
                    <p key={i} className="text-sm">{r.date} — {r.title}: {r.amount}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
