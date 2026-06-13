import { db, type Transaction, type SplitData } from "@/lib/db"
import { assertGroupAllowsExpenseMutations } from "@/lib/group-guards"
import { validateSplitData } from "@/lib/settlement"
import { getGroupMembers } from "@/features/groups/groups.db"

export async function getGroupTransactions(groupId: string): Promise<Transaction[]> {
  return db.transactions
    .where("groupId")
    .equals(groupId)
    .sortBy("transactionDateTime")
}

export async function getGroupExpenses(groupId: string): Promise<Transaction[]> {
  const all = await getGroupTransactions(groupId)
  return all.filter((t) => t.type === "expense" || t.type === "refund")
}

export async function addGroupExpense(input: {
  groupId: string
  title: string
  amountPaise: number
  categoryId: string
  transactionDateTime: string
  notes?: string
  paidByMemberId: string
  splitData: SplitData
}): Promise<Transaction> {
  await assertGroupAllowsExpenseMutations(input.groupId)
  const members = await getGroupMembers(input.groupId)
  const memberIds = members.filter((m) => m.isActive).map((m) => m.id)
  const error = validateSplitData(input.amountPaise, input.splitData, memberIds)
  if (error) throw new Error(error)

  const now = new Date().toISOString()
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    type: "expense",
    title: input.title.trim(),
    amountPaise: input.amountPaise,
    categoryId: input.categoryId,
    paidByMemberId: input.paidByMemberId,
    splitMethod: input.splitData.method,
    splitData: input.splitData,
    notes: input.notes?.trim(),
    transactionDateTime: input.transactionDateTime,
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(transaction)
  return transaction
}

export async function addRefund(input: {
  groupId: string
  refundOfTransactionId: string
  title: string
  amountPaise: number
  categoryId?: string
  paidByMemberId: string
  splitData: SplitData
  transactionDateTime: string
  notes?: string
}): Promise<Transaction> {
  await assertGroupAllowsExpenseMutations(input.groupId)
  const members = await getGroupMembers(input.groupId)
  const memberIds = members.filter((m) => m.isActive).map((m) => m.id)
  const error = validateSplitData(input.amountPaise, input.splitData, memberIds)
  if (error) throw new Error(error)

  const now = new Date().toISOString()
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    type: "refund",
    title: input.title.trim(),
    amountPaise: input.amountPaise,
    categoryId: input.categoryId,
    paidByMemberId: input.paidByMemberId,
    splitMethod: input.splitData.method,
    splitData: input.splitData,
    refundOfTransactionId: input.refundOfTransactionId,
    notes: input.notes?.trim(),
    transactionDateTime: input.transactionDateTime,
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(transaction)
  return transaction
}

export async function updateTransaction(
  id: string,
  changes: Partial<Omit<Transaction, "id" | "groupId" | "type" | "createdAt">>
): Promise<void> {
  const existing = await db.transactions.get(id)
  if (!existing) throw new Error("Transaction not found.")
  if (existing.type === "settlement_payment") {
    throw new Error("Settlement payments cannot be edited.")
  }
  await assertGroupAllowsExpenseMutations(existing.groupId)

  if (changes.splitData && (changes.amountPaise ?? existing.amountPaise)) {
    const members = await getGroupMembers(existing.groupId)
    const memberIds = members.filter((m) => m.isActive).map((m) => m.id)
    const error = validateSplitData(
      changes.amountPaise ?? existing.amountPaise,
      changes.splitData,
      memberIds
    )
    if (error) throw new Error(error)
  }

  await db.transactions.update(id, {
    ...changes,
    splitMethod: changes.splitData?.method ?? changes.splitMethod,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await db.transactions.get(id)
  if (!existing) return
  if (existing.type === "settlement_payment") {
    throw new Error("Settlement payments cannot be deleted individually during settlement.")
  }
  await assertGroupAllowsExpenseMutations(existing.groupId)
  await db.transactions.delete(id)
}

export function sumGroupExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amountPaise, 0)
}
