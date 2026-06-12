import { useLiveQuery } from "dexie-react-hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { GroupExpense, GroupMember } from "@/lib/db"
import { formatINR } from "@/lib/money"
import {
  applyPaidSettlements,
  computeNetBalances,
  getMemberDisplayName,
  simplifyDebts,
} from "@/lib/settlement"
import { getPaidSettlements, getSettlementHistory, markSettlementPaid } from "@/features/settlements/settlements.db"

interface SettlementsPanelProps {
  groupId: string
  members: GroupMember[]
  expenses: GroupExpense[]
}

export function SettlementsPanel({ groupId, members, expenses }: SettlementsPanelProps) {
  const settlementData = useLiveQuery(async () => {
    const [paid, history] = await Promise.all([
      getPaidSettlements(groupId),
      getSettlementHistory(groupId),
    ])
    const balances = computeNetBalances(expenses, members)
    const debts = simplifyDebts(balances)
    const outstanding = applyPaidSettlements(debts, paid)
    return { outstanding, history }
  }, [groupId, expenses, members])

  if (!settlementData) return <p className="text-muted-foreground">Loading settlements...</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Outstanding Settlements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settlementData.outstanding.length === 0 ? (
            <p className="text-sm text-muted-foreground">All settled up!</p>
          ) : (
            settlementData.outstanding.map((debt) => (
              <div
                key={`${debt.fromUserId}-${debt.toUserId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <p className="text-sm">
                  <span className="font-medium">
                    {getMemberDisplayName(members, debt.fromUserId)}
                  </span>
                  {" owes "}
                  <span className="font-medium">
                    {getMemberDisplayName(members, debt.toUserId)}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge>{formatINR(debt.amountPaise)}</Badge>
                  <Button
                    size="sm"
                    onClick={() =>
                      markSettlementPaid({
                        groupId,
                        fromUserId: debt.fromUserId,
                        toUserId: debt.toUserId,
                        amountPaise: debt.amountPaise,
                      })
                    }
                  >
                    Mark Paid
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settlement History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settlementData.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settlement history.</p>
          ) : (
            settlementData.history.map((record) => (
              <div key={record.id} className="flex justify-between text-sm border-b border-border pb-2">
                <span>
                  {getMemberDisplayName(members, record.fromUserId)} →{" "}
                  {getMemberDisplayName(members, record.toUserId)}
                </span>
                <span className="text-muted-foreground">
                  {formatINR(record.amountPaise)} · {record.paidAt?.slice(0, 10)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
