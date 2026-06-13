import {
  db,
  type Account,
  type AppMeta,
  type AppSettings,
  type Category,
  type Friend,
  type Group,
  type GroupMember,
  type PersonalExpense,
  type Transaction,
} from "@/lib/db"

export interface IntegrityIssue {
  code: string
  message: string
  entityType: string
  entityId?: string
}

export interface IntegrityReport {
  valid: boolean
  issues: IntegrityIssue[]
}

export async function validateDatabaseIntegrity(): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = []

  const [
    accounts,
    friends,
    categories,
    personalExpenses,
    groups,
    members,
    transactions,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.friends.toArray(),
    db.categories.toArray(),
    db.personalExpenses.toArray(),
    db.groups.toArray(),
    db.groupMembers.toArray(),
    db.transactions.toArray(),
  ])

  const accountIds = new Set(accounts.map((a) => a.id))
  const friendIds = new Set(friends.map((f) => f.id))
  const categoryIds = new Set(categories.map((c) => c.id))
  const groupIds = new Set(groups.map((g) => g.id))
  const memberByGroup = new Map<string, Set<string>>()
  for (const m of members) {
    if (!memberByGroup.has(m.groupId)) memberByGroup.set(m.groupId, new Set())
    memberByGroup.get(m.groupId)!.add(m.id)
  }

  for (const friend of friends) {
    if (!accountIds.has(friend.ownerAccountId)) {
      issues.push({
        code: "orphan_friend_owner",
        message: `Friend ${friend.id} references missing account ${friend.ownerAccountId}`,
        entityType: "friend",
        entityId: friend.id,
      })
    }
  }

  for (const cat of categories) {
    if (cat.scope === "personal" && cat.ownerAccountId && !accountIds.has(cat.ownerAccountId)) {
      issues.push({
        code: "orphan_category_owner",
        message: `Category ${cat.id} references missing account`,
        entityType: "category",
        entityId: cat.id,
      })
    }
    if (cat.scope === "group" && cat.groupId && !groupIds.has(cat.groupId)) {
      issues.push({
        code: "orphan_category_group",
        message: `Category ${cat.id} references missing group`,
        entityType: "category",
        entityId: cat.id,
      })
    }
  }

  for (const expense of personalExpenses) {
    if (!accountIds.has(expense.ownerAccountId)) {
      issues.push({
        code: "orphan_personal_expense_owner",
        message: `Personal expense ${expense.id} references missing account`,
        entityType: "personalExpense",
        entityId: expense.id,
      })
    }
    if (!categoryIds.has(expense.categoryId)) {
      issues.push({
        code: "orphan_personal_expense_category",
        message: `Personal expense ${expense.id} references missing category`,
        entityType: "personalExpense",
        entityId: expense.id,
      })
    }
  }

  for (const group of groups) {
    if (!accountIds.has(group.createdByAccountId)) {
      issues.push({
        code: "orphan_group_owner",
        message: `Group ${group.id} references missing account`,
        entityType: "group",
        entityId: group.id,
      })
    }
  }

  for (const member of members) {
    if (!groupIds.has(member.groupId)) {
      issues.push({
        code: "orphan_member_group",
        message: `Member ${member.id} references missing group`,
        entityType: "groupMember",
        entityId: member.id,
      })
    }
    if (member.linkedFriendId && !friendIds.has(member.linkedFriendId)) {
      issues.push({
        code: "orphan_member_friend",
        message: `Member ${member.id} references missing friend`,
        entityType: "groupMember",
        entityId: member.id,
      })
    }
    if (member.linkedAccountId && !accountIds.has(member.linkedAccountId)) {
      issues.push({
        code: "orphan_member_account",
        message: `Member ${member.id} references missing account`,
        entityType: "groupMember",
        entityId: member.id,
      })
    }
  }

  for (const tx of transactions) {
    if (!groupIds.has(tx.groupId)) {
      issues.push({
        code: "orphan_transaction_group",
        message: `Transaction ${tx.id} references missing group`,
        entityType: "transaction",
        entityId: tx.id,
      })
      continue
    }
    const groupMemberIds = memberByGroup.get(tx.groupId) ?? new Set()
    if (!groupMemberIds.has(tx.paidByMemberId)) {
      issues.push({
        code: "orphan_transaction_payer",
        message: `Transaction ${tx.id} references missing member payer`,
        entityType: "transaction",
        entityId: tx.id,
      })
    }
    if (tx.categoryId && !categoryIds.has(tx.categoryId)) {
      issues.push({
        code: "orphan_transaction_category",
        message: `Transaction ${tx.id} references missing category`,
        entityType: "transaction",
        entityId: tx.id,
      })
    }
    if (tx.settlementFromMemberId && !groupMemberIds.has(tx.settlementFromMemberId)) {
      issues.push({
        code: "orphan_settlement_from",
        message: `Settlement ${tx.id} references missing from member`,
        entityType: "transaction",
        entityId: tx.id,
      })
    }
    if (tx.settlementToMemberId && !groupMemberIds.has(tx.settlementToMemberId)) {
      issues.push({
        code: "orphan_settlement_to",
        message: `Settlement ${tx.id} references missing to member`,
        entityType: "transaction",
        entityId: tx.id,
      })
    }
    if (tx.refundOfTransactionId) {
      const refundTarget = transactions.find((t) => t.id === tx.refundOfTransactionId)
      if (!refundTarget) {
        issues.push({
          code: "orphan_refund_target",
          message: `Refund ${tx.id} references missing expense`,
          entityType: "transaction",
          entityId: tx.id,
        })
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

export async function assertCleanAfterOperation(operation: string): Promise<void> {
  const report = await validateDatabaseIntegrity()
  if (!report.valid) {
    throw new Error(
      `Integrity check failed after ${operation}: ${report.issues.map((i) => i.message).join("; ")}`
    )
  }
}

export async function cleanupOrphans(scope: "group" | "account" | "full"): Promise<number> {
  let removed = 0
  const report = await validateDatabaseIntegrity()
  if (report.valid) return 0

  if (scope === "full" || scope === "group") {
    const groupIds = new Set((await db.groups.toArray()).map((g) => g.id))
    const orphans = await db.transactions.filter((t) => !groupIds.has(t.groupId)).toArray()
    for (const tx of orphans) {
      await db.transactions.delete(tx.id)
      removed++
    }
  }

  return removed
}

export type DatabaseSnapshot = {
  accounts: Account[]
  friends: Friend[]
  categories: Category[]
  personalExpenses: PersonalExpense[]
  groups: Group[]
  groupMembers: GroupMember[]
  transactions: Transaction[]
  settings: AppSettings[]
  appMeta: AppMeta[]
}

export async function createDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const [
    accounts,
    friends,
    categories,
    personalExpenses,
    groups,
    groupMembers,
    transactions,
    settings,
    appMeta,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.friends.toArray(),
    db.categories.toArray(),
    db.personalExpenses.toArray(),
    db.groups.toArray(),
    db.groupMembers.toArray(),
    db.transactions.toArray(),
    db.settings.toArray(),
    db.appMeta.toArray(),
  ])
  return {
    accounts,
    friends,
    categories,
    personalExpenses,
    groups,
    groupMembers,
    transactions,
    settings,
    appMeta,
  }
}

export async function restoreDatabaseSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
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
      await Promise.all([
        db.accounts.clear(),
        db.friends.clear(),
        db.categories.clear(),
        db.personalExpenses.clear(),
        db.groups.clear(),
        db.groupMembers.clear(),
        db.transactions.clear(),
        db.settings.clear(),
        db.appMeta.clear(),
      ])
      if (snapshot.accounts.length) await db.accounts.bulkPut(snapshot.accounts)
      if (snapshot.friends.length) await db.friends.bulkPut(snapshot.friends)
      if (snapshot.categories.length) await db.categories.bulkPut(snapshot.categories)
      if (snapshot.personalExpenses.length) await db.personalExpenses.bulkPut(snapshot.personalExpenses)
      if (snapshot.groups.length) await db.groups.bulkPut(snapshot.groups)
      if (snapshot.groupMembers.length) await db.groupMembers.bulkPut(snapshot.groupMembers)
      if (snapshot.transactions.length) await db.transactions.bulkPut(snapshot.transactions)
      if (snapshot.settings.length) await db.settings.bulkPut(snapshot.settings)
      if (snapshot.appMeta.length) await db.appMeta.bulkPut(snapshot.appMeta)
    }
  )
}
