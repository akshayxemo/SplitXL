import { useState } from "react"
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { formatDateTime } from "@/components/DateTimePickerModal"
import type { Category, GroupMember, Transaction } from "@/lib/db"
import { formatINR } from "@/lib/money"
import { computeShares, getMemberDisplayName } from "@/lib/settlement"
import { formatCategoryLabel } from "@/features/categories/categories.db"

interface TransactionTimelineProps {
  transactions: Transaction[]
  members: GroupMember[]
  categories: Category[]
  groupReadOnly: boolean
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
}

export function TransactionTimeline({
  transactions,
  members,
  categories,
  groupReadOnly,
  onEdit,
  onDelete,
}: TransactionTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const sorted = [...transactions].sort((a, b) =>
    b.transactionDateTime.localeCompare(a.transactionDateTime)
  )

  return (
    <div className="space-y-3">
      {sorted.map((tx) => {
        const expanded = expandedId === tx.id
        const category = tx.categoryId ? categoryMap[tx.categoryId] : undefined
        const emoji =
          tx.type === "settlement_payment" ? "💸" : tx.type === "refund" ? "↩️" : category?.emoji ?? "📁"

        return (
          <Card key={tx.id} size="sm">
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="flex flex-1 items-start gap-3 text-left"
                  onClick={() => setExpandedId(expanded ? null : tx.id)}
                >
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <p className="font-medium">{tx.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(tx.transactionDateTime)} · Paid by{" "}
                      {getMemberDisplayName(members, tx.paidByMemberId)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Badge>{formatINR(tx.amountPaise)}</Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                  >
                    {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  {tx.notes && (
                    <p>
                      <span className="text-muted-foreground">Notes:</span> {tx.notes}
                    </p>
                  )}
                  {category && (
                    <p>
                      <span className="text-muted-foreground">Category:</span>{" "}
                      {formatCategoryLabel(category)}
                    </p>
                  )}
                  {tx.splitMethod && (
                    <p>
                      <span className="text-muted-foreground">Split:</span>{" "}
                      {tx.splitMethod.replace(/_/g, " ")}
                    </p>
                  )}
                  {(tx.type === "expense" || tx.type === "refund") && tx.splitData && (() => {
                    const shares = computeShares(tx, members)
                    const participants = members.filter((m) => {
                      if (tx.splitData?.method === "equal_all") return m.isActive
                      return (shares[m.id] ?? 0) > 0
                    })
                    if (participants.length === 0) return null
                    return (
                      <div>
                        <p className="text-muted-foreground mb-1">Split breakdown:</p>
                        <table className="w-full text-xs">
                          <tbody>
                            {participants.map((m) => (
                              <tr key={m.id}>
                                <td className="pr-2">{m.displayName}</td>
                                <td className="text-right">{formatINR(shares[m.id] ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                  <p>
                    <span className="text-muted-foreground">Type:</span> {tx.type.replace(/_/g, " ")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Date & time:</span>{" "}
                    {formatDateTime(tx.transactionDateTime)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {formatDateTime(tx.createdAt)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Updated:</span>{" "}
                    {formatDateTime(tx.updatedAt)}
                  </p>
                  {tx.refundOfTransactionId && (
                    <p>
                      <span className="text-muted-foreground">Refund of:</span>{" "}
                      {tx.refundOfTransactionId}
                    </p>
                  )}
                  {tx.type === "settlement_payment" && (
                    <p>
                      <span className="text-muted-foreground">Settlement:</span>{" "}
                      {getMemberDisplayName(members, tx.settlementFromMemberId ?? tx.paidByMemberId)} →{" "}
                      {getMemberDisplayName(members, tx.settlementToMemberId ?? "")}
                    </p>
                  )}
                  {!groupReadOnly && tx.type !== "settlement_payment" && (
                    <div className="flex gap-2 pt-2">
                      {onEdit && (
                        <Button variant="outline" size="sm" onClick={() => onEdit(tx)}>
                          <Pencil className="size-3 mr-1" /> Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="outline" size="sm" onClick={() => setDeleteTarget(tx)}>
                          <Trash2 className="size-3 mr-1 text-destructive" /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      <ConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete transaction?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget && onDelete) onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
