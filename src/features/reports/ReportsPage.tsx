import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { pdf } from "@react-pdf/renderer"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { db } from "@/lib/db"
import { formatINR } from "@/lib/money"
import { useAuthStore } from "@/stores/auth.store"
import { groupByCategory, sumExpenses } from "@/features/expenses/expenses.db"
import { getActiveGroups, sumGroupExpenses } from "@/features/groups/groups.db"
import {
  applyPaidSettlements,
  computeNetBalances,
  getMemberDisplayName,
  simplifyDebts,
} from "@/lib/settlement"
import { PersonalReportDocument } from "@/features/reports/PersonalReportDocument"
import { GroupReportDocument } from "@/features/reports/GroupReportDocument"

export function ReportsPage() {
  const user = useAuthStore((s) => s.user)!
  const [reportType, setReportType] = useState<"personal" | "group">("personal")
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"))

  const groups = useLiveQuery(() => getActiveGroups(user.userId), [user.userId])

  const reportData = useLiveQuery(async () => {
    const [y, m] = month.split("-").map(Number)
    const start = format(startOfMonth(new Date(y, m - 1)), "yyyy-MM-dd")
    const end = format(endOfMonth(new Date(y, m - 1)), "yyyy-MM-dd")

    if (reportType === "personal") {
      const expenses = await db.personalExpenses
        .where("ownerUserId")
        .equals(user.userId)
        .filter((e) => e.date >= start && e.date <= end)
        .toArray()
      const categories = await db.categories.toArray()
      const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
      const byCategory = groupByCategory(expenses)
      const categoryBreakdown = Object.entries(byCategory).map(([id, amount]) => ({
        name: categoryMap[id] ?? "Unknown",
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
          category: categoryMap[e.categoryId] ?? "Unknown",
          amount: formatINR(e.amountPaise),
        })),
      }
    }

    if (!selectedGroupId) return null

    const group = await db.groups.get(selectedGroupId)
    if (!group) return null

    const [members, expenses, settlements] = await Promise.all([
      db.groupMembers.where("groupId").equals(selectedGroupId).toArray(),
      db.groupExpenses.where("groupId").equals(selectedGroupId).filter((e) => e.date >= start && e.date <= end).toArray(),
      db.settlements.where("groupId").equals(selectedGroupId).filter((s) => s.status === "paid").toArray(),
    ])

    const activeMembers = members.filter((m) => m.isActive)
    const balances = computeNetBalances(expenses, activeMembers)
    const debts = simplifyDebts(balances)
    const outstanding = applyPaidSettlements(debts, settlements)

    return {
      type: "group" as const,
      title: `Group Report — ${group.name} — ${month}`,
      groupName: group.name,
      total: formatINR(sumGroupExpenses(expenses)),
      expenseCount: expenses.length,
      budget: group.budgetPaise ? formatINR(group.budgetPaise) : "Not set",
      settlements: outstanding.map((d) => ({
        from: getMemberDisplayName(activeMembers, d.fromUserId),
        to: getMemberDisplayName(activeMembers, d.toUserId),
        amount: formatINR(d.amountPaise),
      })),
      expenses: expenses.map((e) => ({
        title: e.title,
        date: e.date,
        amount: formatINR(e.amountPaise),
        paidBy: getMemberDisplayName(activeMembers, e.paidByUserId),
      })),
    }
  }, [reportType, selectedGroupId, month, user.userId])

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
    anchor.download = `splitxl-report-${month}.pdf`
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
            <Select value={reportType} onChange={(e) => setReportType(e.target.value as "personal" | "group")}>
              <option value="personal">Personal</option>
              <option value="group">Group</option>
            </Select>
          </div>
          <div>
            <Label>Month</Label>
            <input
              type="month"
              className="h-9 w-full rounded-md border border-input px-2.5 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          {reportType === "group" && (
            <div>
              <Label>Group</Label>
              <Select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
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
                <h3 className="font-medium mb-2">Expenses</h3>
                {reportData.expenses.map((e, i) => (
                  <p key={i} className="text-sm">{e.date} — {e.title} (paid by {e.paidBy}): {e.amount}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
