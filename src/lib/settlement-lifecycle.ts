import { computeNetBalances, simplifyDebts } from "@/lib/settlement"
import { getGroupMembers } from "@/features/groups/groups.db"
import { getGroupTransactions } from "@/features/transactions/transactions.db"
import { db } from "@/lib/db"
import { getGroupOrThrow } from "@/lib/group-guards"

export async function checkAndCompleteSettlement(groupId: string): Promise<boolean> {
  const group = await getGroupOrThrow(groupId)
  if (group.status !== "settlement_in_progress") return false

  const [members, transactions] = await Promise.all([
    getGroupMembers(groupId),
    getGroupTransactions(groupId),
  ])
  const balances = computeNetBalances(transactions, members)
  const debts = simplifyDebts(balances)
  if (debts.length > 0) return false

  await db.groups.update(groupId, {
    status: "settled",
    settledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return true
}
