import { db, type Transaction } from "@/lib/db"
import { getGroupOrThrow } from "@/lib/group-guards"
import { checkAndCompleteSettlement } from "@/lib/settlement-lifecycle"

export async function markSettlementPaid(input: {
  groupId: string
  fromMemberId: string
  toMemberId: string
  amountPaise: number
  note?: string
}): Promise<Transaction> {
  const group = await getGroupOrThrow(input.groupId)
  if (group.status !== "settlement_in_progress" && group.status !== "active") {
    throw new Error("Settlements can only be recorded on active or settling groups.")
  }

  const now = new Date().toISOString()
  const record: Transaction = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    type: "settlement_payment",
    title: "Settlement payment",
    amountPaise: input.amountPaise,
    paidByMemberId: input.fromMemberId,
    settlementFromMemberId: input.fromMemberId,
    settlementToMemberId: input.toMemberId,
    notes: input.note,
    transactionDateTime: now,
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(record)
  await checkAndCompleteSettlement(input.groupId)
  return record
}

export async function getSettlementHistory(groupId: string): Promise<Transaction[]> {
  const records = await db.transactions
    .where("groupId")
    .equals(groupId)
    .filter((t) => t.type === "settlement_payment")
    .toArray()
  return records.sort((a, b) => b.transactionDateTime.localeCompare(a.transactionDateTime))
}

export async function getSettlementPayments(groupId: string): Promise<Transaction[]> {
  return getSettlementHistory(groupId)
}

export async function hasSettlementPayments(groupId: string): Promise<boolean> {
  const count = await db.transactions
    .where("groupId")
    .equals(groupId)
    .filter((t) => t.type === "settlement_payment")
    .count()
  return count > 0
}
