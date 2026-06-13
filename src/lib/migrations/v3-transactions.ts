import type { Transaction } from "@/lib/db"
import type { UpgradeTx } from "@/lib/migrations/types"

export async function migrateV3(tx: UpgradeTx): Promise<void> {
  const expenses = await tx.table("groupExpenses").toArray()
  const settlements = await tx.table("settlements").toArray()
  const transactions: Transaction[] = []

  for (const expense of expenses) {
    const date = expense.date as string
    transactions.push({
      id: expense.id as string,
      groupId: expense.groupId as string,
      type: "expense",
      title: expense.title as string,
      amountPaise: expense.amountPaise as number,
      categoryId: expense.categoryId as string,
      paidByMemberId: expense.paidByUserId as string,
      splitMethod: expense.splitMethod as Transaction["splitMethod"],
      splitData: expense.splitData as Transaction["splitData"],
      notes: expense.notes as string | undefined,
      transactionDateTime: `${date}T12:00:00.000Z`,
      createdAt: expense.createdAt as string,
      updatedAt: expense.updatedAt as string,
    })
  }

  for (const record of settlements) {
    if (record.status !== "paid") continue
    const paidAt = (record.paidAt as string | undefined) ?? (record.createdAt as string)
    transactions.push({
      id: record.id as string,
      groupId: record.groupId as string,
      type: "settlement_payment",
      title: "Settlement payment",
      amountPaise: record.amountPaise as number,
      paidByMemberId: record.fromUserId as string,
      settlementFromMemberId: record.fromUserId as string,
      settlementToMemberId: record.toUserId as string,
      notes: record.note as string | undefined,
      transactionDateTime: paidAt,
      createdAt: record.createdAt as string,
      updatedAt: paidAt,
    })
  }

  if (transactions.length) {
    await tx.table("transactions").bulkPut(transactions as unknown as Record<string, unknown>[])
  }

  await tx.table("groupExpenses").clear()
  await tx.table("settlements").clear()
}
