import { useLiveQuery } from "dexie-react-hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import type { GroupMember, Transaction } from "@/lib/db"
import { getGroupOrThrow } from "@/lib/group-guards"
import { formatINR } from "@/lib/money"
import {
  computeNetBalances,
  getMemberDisplayName,
  simplifyDebts,
} from "@/lib/settlement"
import { cancelSettlement, startSettlement } from "@/features/groups/groups.db"
import { getSettlementHistory, markSettlementPaid } from "@/features/settlements/settlements.db"
import { useState } from "react"

interface SettlementsPanelProps {
  groupId: string
  members: GroupMember[]
  transactions: Transaction[]
}

export function SettlementsPanel({ groupId, members, transactions }: SettlementsPanelProps) {
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const settlementData = useLiveQuery(async () => {
    const [group, history] = await Promise.all([
      getGroupOrThrow(groupId),
      getSettlementHistory(groupId),
    ])
    const balances = computeNetBalances(transactions, members)
    const outstanding = simplifyDebts(balances)
    return { outstanding, history, group }
  }, [groupId, transactions, members])

  if (!settlementData) return <p className="text-muted-foreground">Loading settlements...</p>

  const { group } = settlementData

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {group.status === "active" && (
          <Button onClick={() => setConfirmStart(true)}>Start Settlement</Button>
        )}
        {group.status === "settlement_in_progress" && (
          <Button variant="outline" onClick={() => setConfirmCancel(true)}>
            Cancel Settlement
          </Button>
        )}
        {group.status === "settled" && (
          <Badge variant="outline">Group is settled and read-only</Badge>
        )}
      </div>

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
                key={`${debt.fromMemberId}-${debt.toMemberId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <p className="text-sm">
                  <span className="font-medium">
                    {getMemberDisplayName(members, debt.fromMemberId)}
                  </span>
                  {" owes "}
                  <span className="font-medium">
                    {getMemberDisplayName(members, debt.toMemberId)}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge>{formatINR(debt.amountPaise)}</Badge>
                  {group.status === "settlement_in_progress" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        markSettlementPaid({
                          groupId,
                          fromMemberId: debt.fromMemberId,
                          toMemberId: debt.toMemberId,
                          amountPaise: debt.amountPaise,
                        })
                      }
                    >
                      Mark Paid
                    </Button>
                  )}
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
                  {getMemberDisplayName(members, record.settlementFromMemberId ?? record.paidByMemberId)}{" "}
                  → {getMemberDisplayName(members, record.settlementToMemberId ?? "")}
                </span>
                <span className="text-muted-foreground">
                  {formatINR(record.amountPaise)} · {record.transactionDateTime.slice(0, 10)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmationModal
        open={confirmStart}
        onOpenChange={setConfirmStart}
        title="Start settlement?"
        description="This action will lock the group and prevent any future expense, refund, member, or group modifications. Settlement records remain allowed."
        confirmLabel="Start Settlement"
        onConfirm={async () => {
          await startSettlement(groupId)
          setConfirmStart(false)
        }}
      />

      <ConfirmationModal
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel settlement?"
        description="Return the group to active state. This is only allowed if no settlement payments exist."
        confirmLabel="Cancel Settlement"
        onConfirm={async () => {
          await cancelSettlement(groupId)
          setConfirmCancel(false)
        }}
      />
    </div>
  )
}
