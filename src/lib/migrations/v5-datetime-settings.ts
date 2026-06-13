import type { UpgradeTx } from "@/lib/migrations/types"

export async function migrateV5(tx: UpgradeTx): Promise<void> {
  const now = new Date().toISOString()

  const personalExpenses = await tx.table("personalExpenses").toArray()
  for (const expense of personalExpenses) {
    const date = expense.date as string
    const transactionDateTime =
      (expense.transactionDateTime as string | undefined) ?? `${date}T12:00:00.000Z`
    await tx.table("personalExpenses").put({
      ...expense,
      transactionDateTime,
    })
  }

  const accounts = await tx.table("accounts").toArray()
  for (const account of accounts) {
    await tx.table("settings").put({
      id: account.id as string,
      updatedAt: now,
    })
  }

  const meta = await tx.table("appMeta").toArray()
  if (meta.length) {
    await tx.table("appMeta").put({
      ...meta[0],
      schemaVersion: 5,
    })
  }
}
