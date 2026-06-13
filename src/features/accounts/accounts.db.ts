import { db, type Account } from "@/lib/db"
import { validateDatabaseIntegrity } from "@/lib/db-integrity"

export function validateContact(email?: string, phone?: string): string | null {
  const hasEmail = !!email?.trim()
  const hasPhone = !!phone?.trim()
  if (!hasEmail && !hasPhone) return "At least one of email or phone is required."
  return null
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id)
}

export async function updateAccount(
  id: string,
  changes: Partial<Pick<Account, "displayName" | "email" | "phone">>
): Promise<void> {
  if (changes.email !== undefined || changes.phone !== undefined) {
    const error = validateContact(changes.email, changes.phone)
    if (error && !changes.email?.trim() && !changes.phone?.trim()) {
      // Allow clearing both only if account already has displayName
    } else if (error && changes.email !== undefined && changes.phone !== undefined) {
      throw new Error(error)
    }
  }
  await db.accounts.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function deleteAccountData(accountId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.accounts,
      db.friends,
      db.categories,
      db.personalExpenses,
      db.groups,
      db.groupMembers,
      db.transactions,
      db.settings,
      db.appMeta,
    ],
    async () => {
      const groups = await db.groups.filter((g) => g.createdByAccountId === accountId).toArray()
      const groupIds = groups.map((g) => g.id)

      for (const groupId of groupIds) {
        await db.transactions.where("groupId").equals(groupId).delete()
        await db.groupMembers.where("groupId").equals(groupId).delete()
        await db.categories.filter((c) => c.groupId === groupId).delete()
        await db.groups.delete(groupId)
      }

      await db.personalExpenses.where("ownerAccountId").equals(accountId).delete()
      await db.categories
        .filter((c) => c.scope === "personal" && c.ownerAccountId === accountId)
        .delete()
      await db.friends.where("ownerAccountId").equals(accountId).delete()
      await db.settings.delete(accountId)
      await db.accounts.delete(accountId)
    }
  )

  const report = await validateDatabaseIntegrity()
  if (!report.valid) {
    const summary = report.issues.map((i) => i.message).join("; ")
    console.error("Integrity check failed after deleteAccountData:", summary)
    throw new Error(`Data integrity issues found after account deletion: ${summary}`)
  }
}
