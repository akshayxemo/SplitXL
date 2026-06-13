import { z } from "zod"
import {
  db,
  EXPORT_VERSION,
  SCHEMA_VERSION,
  type Account,
  type AuthUser,
} from "@/lib/db"
import {
  assertCleanAfterOperation,
  createDatabaseSnapshot,
  restoreDatabaseSnapshot,
  validateDatabaseIntegrity,
} from "@/lib/db-integrity"

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  scope: z.enum(["global", "group", "personal", "private"]),
  groupId: z.string().optional(),
  ownerAccountId: z.string().optional(),
  ownerUserId: z.string().optional(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

const personalExpenseSchema = z.object({
  id: z.string(),
  ownerAccountId: z.string().optional(),
  ownerUserId: z.string().optional(),
  title: z.string(),
  amountPaise: z.number().int().nonnegative(),
  categoryId: z.string(),
  date: z.string(),
  transactionDateTime: z.string().optional(),
  notes: z.string().optional(),
  budgetPaise: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  budgetPaise: z.number().int().nonnegative().optional(),
  createdByAccountId: z.string().optional(),
  createdByUserId: z.string().optional(),
  status: z.enum(["active", "settlement_in_progress", "settled", "archived"]).optional(),
  isArchived: z.boolean().optional(),
  settlementStartedAt: z.string().optional(),
  settledAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const groupMemberSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedFriendId: z.string().optional(),
  linkedAccountId: z.string().optional(),
  userId: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  joinedAt: z.string().optional(),
})

const splitDataSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("equal_all") }),
  z.object({ method: z.literal("equal_selected"), memberIds: z.array(z.string()) }),
  z.object({ method: z.literal("manual"), shares: z.record(z.string(), z.number()) }),
  z.object({ method: z.literal("percentage"), shares: z.record(z.string(), z.number()) }),
])

const transactionSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  type: z.enum(["expense", "refund", "settlement_payment"]),
  title: z.string(),
  amountPaise: z.number().int().nonnegative(),
  categoryId: z.string().optional(),
  paidByMemberId: z.string(),
  splitMethod: z.enum(["equal_all", "equal_selected", "manual", "percentage"]).optional(),
  splitData: splitDataSchema.optional(),
  refundOfTransactionId: z.string().optional(),
  settlementFromMemberId: z.string().optional(),
  settlementToMemberId: z.string().optional(),
  notes: z.string().optional(),
  transactionDateTime: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const friendSchema = z.object({
  id: z.string(),
  ownerAccountId: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  notes: z.string().optional(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const accountSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const settingsSchema = z.object({
  id: z.string(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  updatedAt: z.string(),
})

const legacyGroupExpenseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string(),
  amountPaise: z.number(),
  categoryId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
  paidByUserId: z.string(),
  splitMethod: z.enum(["equal_all", "equal_selected", "manual", "percentage"]),
  splitData: splitDataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

const legacySettlementSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  amountPaise: z.number(),
  status: z.enum(["pending", "paid"]),
  paidAt: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
})

const exportV2Schema = z.object({
  exportVersion: z.number().default(2),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  account: accountSchema.optional(),
  data: z.object({
    accounts: z.array(accountSchema).optional(),
    friends: z.array(friendSchema).optional(),
    categories: z.array(categorySchema),
    personalExpenses: z.array(personalExpenseSchema),
    groups: z.array(groupSchema),
    groupMembers: z.array(groupMemberSchema),
    transactions: z.array(transactionSchema).optional(),
    groupExpenses: z.array(legacyGroupExpenseSchema).optional(),
    settlements: z.array(legacySettlementSchema).optional(),
    settings: z.array(settingsSchema).optional(),
  }),
})

const exportV1Schema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  data: z.object({
    categories: z.array(categorySchema),
    personalExpenses: z.array(personalExpenseSchema),
    groups: z.array(groupSchema),
    groupMembers: z.array(groupMemberSchema),
    groupExpenses: z.array(legacyGroupExpenseSchema),
    settlements: z.array(legacySettlementSchema),
  }),
})

export type ExportPayload = z.infer<typeof exportV2Schema>
export type ImportPreview = {
  accountName: string
  groups: number
  members: number
  transactions: number
  categories: number
  friends: number
  personalExpenses: number
}

function normalizeCategory(cat: z.infer<typeof categorySchema>) {
  const now = new Date().toISOString()
  return {
    ...cat,
    scope: (cat.scope === "private" ? "personal" : cat.scope) as "global" | "group" | "personal",
    ownerAccountId: cat.ownerAccountId ?? cat.ownerUserId,
    emoji: cat.emoji ?? "📁",
    updatedAt: cat.updatedAt ?? cat.createdAt ?? now,
  }
}

function normalizePersonalExpense(exp: z.infer<typeof personalExpenseSchema>) {
  return {
    ...exp,
    ownerAccountId: exp.ownerAccountId ?? exp.ownerUserId ?? "",
    transactionDateTime: exp.transactionDateTime ?? `${exp.date}T12:00:00.000Z`,
  }
}

function normalizeGroup(group: z.infer<typeof groupSchema>) {
  return {
    ...group,
    createdByAccountId: group.createdByAccountId ?? group.createdByUserId ?? "",
    status: group.status ?? (group.isArchived ? "archived" : "active"),
  }
}

function normalizeMember(member: z.infer<typeof groupMemberSchema>) {
  const now = new Date().toISOString()
  return {
    id: member.id,
    groupId: member.groupId,
    displayName: member.displayName,
    email: member.email,
    phone: member.phone,
    linkedFriendId: member.linkedFriendId,
    linkedAccountId: member.linkedAccountId,
    isActive: member.isActive,
    createdAt: member.createdAt ?? member.joinedAt ?? now,
    updatedAt: member.updatedAt ?? now,
  }
}

function legacyToTransactions(
  groupExpenses: z.infer<typeof legacyGroupExpenseSchema>[],
  settlements: z.infer<typeof legacySettlementSchema>[]
) {
  const transactions: z.infer<typeof transactionSchema>[] = []
  for (const expense of groupExpenses) {
    transactions.push({
      id: expense.id,
      groupId: expense.groupId,
      type: "expense",
      title: expense.title,
      amountPaise: expense.amountPaise,
      categoryId: expense.categoryId,
      paidByMemberId: expense.paidByUserId,
      splitMethod: expense.splitMethod,
      splitData: expense.splitData,
      notes: expense.notes,
      transactionDateTime: `${expense.date}T12:00:00.000Z`,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    })
  }
  for (const record of settlements) {
    if (record.status !== "paid") continue
    const paidAt = record.paidAt ?? record.createdAt
    transactions.push({
      id: record.id,
      groupId: record.groupId,
      type: "settlement_payment",
      title: "Settlement payment",
      amountPaise: record.amountPaise,
      paidByMemberId: record.fromUserId,
      settlementFromMemberId: record.fromUserId,
      settlementToMemberId: record.toUserId,
      notes: record.note,
      transactionDateTime: paidAt,
      createdAt: record.createdAt,
      updatedAt: paidAt,
    })
  }
  return transactions
}

export function migrateExportToCurrent(raw: unknown): ExportPayload {
  const v1 = exportV1Schema.safeParse(raw)
  if (v1.success) {
    const d = v1.data
    return {
      exportVersion: 1,
      schemaVersion: d.schemaVersion,
      exportedAt: d.exportedAt,
      data: {
        categories: d.data.categories.map(normalizeCategory),
        personalExpenses: d.data.personalExpenses.map(normalizePersonalExpense),
        groups: d.data.groups.map(normalizeGroup),
        groupMembers: d.data.groupMembers.map(normalizeMember),
        transactions: legacyToTransactions(d.data.groupExpenses, d.data.settlements),
        friends: [],
        settings: [],
      },
    }
  }
  return exportV2Schema.parse(raw)
}

export async function exportAllData(account?: Account): Promise<ExportPayload> {
  const [
    accounts,
    friends,
    categories,
    personalExpenses,
    groups,
    groupMembers,
    transactions,
    settings,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.friends.toArray(),
    db.categories.toArray(),
    db.personalExpenses.toArray(),
    db.groups.toArray(),
    db.groupMembers.toArray(),
    db.transactions.toArray(),
    db.settings.toArray(),
  ])

  const activeAccount = account ?? accounts[0]

  return {
    exportVersion: EXPORT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    account: activeAccount,
    data: {
      accounts,
      friends,
      categories,
      personalExpenses,
      groups,
      groupMembers,
      transactions,
      settings,
    },
  }
}

export function downloadExport(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `splitxl-backup-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseImportFile(content: string): ExportPayload {
  const parsed = JSON.parse(content) as unknown
  return migrateExportToCurrent(parsed)
}

export function buildImportPreview(payload: ExportPayload): ImportPreview {
  const d = payload.data
  return {
    accountName: payload.account?.displayName ?? d.accounts?.[0]?.displayName ?? "Unknown",
    groups: d.groups.length,
    members: d.groupMembers.length,
    transactions: (d.transactions ?? []).length,
    categories: d.categories.length,
    friends: (d.friends ?? []).length,
    personalExpenses: d.personalExpenses.length,
  }
}

async function clearAllData(): Promise<void> {
  await Promise.all([
    db.accounts.clear(),
    db.friends.clear(),
    db.categories.clear(),
    db.personalExpenses.clear(),
    db.groups.clear(),
    db.groupMembers.clear(),
    db.transactions.clear(),
    db.settings.clear(),
  ])
}

async function writeImportData(payload: ExportPayload): Promise<void> {
  const d = payload.data
  const categories = d.categories.map(normalizeCategory)
  const personalExpenses = d.personalExpenses.map(normalizePersonalExpense)
  const groups = d.groups.map(normalizeGroup)
  const groupMembers = d.groupMembers.map(normalizeMember)
  const transactions =
    d.transactions ?? legacyToTransactions(d.groupExpenses ?? [], d.settlements ?? [])

  if (categories.length) await db.categories.bulkPut(categories)
  if (personalExpenses.length) await db.personalExpenses.bulkPut(personalExpenses)
  if (groups.length) await db.groups.bulkPut(groups)
  if (groupMembers.length) await db.groupMembers.bulkPut(groupMembers)
  if (transactions.length) await db.transactions.bulkPut(transactions)
  if (d.friends?.length) await db.friends.bulkPut(d.friends)
  if (d.settings?.length) await db.settings.bulkPut(d.settings)
  if (d.accounts?.length) await db.accounts.bulkPut(d.accounts)
  else if (payload.account) await db.accounts.put(payload.account)

  await db.appMeta.put({
    id: "meta",
    schemaVersion: SCHEMA_VERSION,
    lastExportAt: payload.exportedAt,
  })
}

function dedupeCategories(
  incoming: ReturnType<typeof normalizeCategory>[],
  existing: ReturnType<typeof normalizeCategory>[]
) {
  const key = (c: { name: string; scope: string; groupId?: string; ownerAccountId?: string }) =>
    `${c.scope}:${c.groupId ?? ""}:${c.ownerAccountId ?? ""}:${c.name.toLowerCase()}`
  const existingKeys = new Set(existing.map(key))
  return incoming.filter((c) => !existingKeys.has(key(c)))
}

function dedupeFriends(
  incoming: z.infer<typeof friendSchema>[],
  existing: z.infer<typeof friendSchema>[]
) {
  const key = (f: { email?: string; phone?: string; displayName: string }) =>
    f.email?.toLowerCase() ?? f.phone ?? f.displayName.toLowerCase()
  const existingKeys = new Set(existing.map(key))
  return incoming.filter((f) => !existingKeys.has(key(f)))
}

export async function importAllData(
  payload: ExportPayload,
  options: { mode: "replace" | "merge"; newUser?: AuthUser }
): Promise<void> {
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error("Backup was created with a newer app version.")
  }

  const normalized = migrateExportToCurrent(payload)
  const snapshot = await createDatabaseSnapshot()

  try {
    if (options.mode === "replace") {
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
          await clearAllData()
          await writeImportData(normalized)
        }
      )
    } else {
      const currentCategories = (await db.categories.toArray()).map(normalizeCategory)
      const currentFriends = await db.friends.toArray()
      const incomingAccountId =
        normalized.account?.id ?? normalized.data.accounts?.[0]?.id ?? options.newUser?.accountId
      if (!incomingAccountId) throw new Error("Import missing account identity.")

      const currentAccountId = options.newUser?.accountId
      if (!currentAccountId) throw new Error("Active account required for merge.")

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
          const newCategories = dedupeCategories(
            normalized.data.categories.map(normalizeCategory),
            currentCategories
          )
          const newFriends = dedupeFriends(normalized.data.friends ?? [], currentFriends)

          const reassignedPersonal = normalized.data.personalExpenses
            .map(normalizePersonalExpense)
            .map((e) => ({ ...e, ownerAccountId: incomingAccountId }))
          const reassignedGroups = normalized.data.groups.map(normalizeGroup).map((g) => ({
            ...g,
            createdByAccountId: incomingAccountId,
          }))
          const reassignedCategories = newCategories.map((c) =>
            c.scope === "personal" ? { ...c, ownerAccountId: incomingAccountId } : c
          )
          const reassignedFriends = newFriends.map((f) => ({
            ...f,
            ownerAccountId: incomingAccountId,
          }))

          if (reassignedCategories.length) await db.categories.bulkPut(reassignedCategories)
          if (reassignedPersonal.length) await db.personalExpenses.bulkPut(reassignedPersonal)
          if (reassignedGroups.length) await db.groups.bulkPut(reassignedGroups)
          if (normalized.data.groupMembers.length)
            await db.groupMembers.bulkPut(normalized.data.groupMembers.map(normalizeMember))
          const txs =
            normalized.data.transactions ??
            legacyToTransactions(normalized.data.groupExpenses ?? [], normalized.data.settlements ?? [])
          if (txs.length) await db.transactions.bulkPut(txs)
          if (reassignedFriends.length) await db.friends.bulkPut(reassignedFriends)

          if (normalized.account) {
            await db.accounts.put({ ...normalized.account, id: incomingAccountId })
          }

          await db.appMeta.put({
            id: "meta",
            schemaVersion: SCHEMA_VERSION,
            lastExportAt: normalized.exportedAt,
          })

          if (currentAccountId !== incomingAccountId) {
            await db.personalExpenses
              .filter((e) => e.ownerAccountId === currentAccountId)
              .modify({ ownerAccountId: incomingAccountId })
            await db.groups
              .filter((g) => g.createdByAccountId === currentAccountId)
              .modify({ createdByAccountId: incomingAccountId })
            await db.friends
              .filter((f) => f.ownerAccountId === currentAccountId)
              .modify({ ownerAccountId: incomingAccountId })
            await db.accounts.delete(currentAccountId)
          }
        }
      )
    }

    const report = await validateDatabaseIntegrity()
    if (!report.valid) {
      throw new Error(report.issues[0]?.message ?? "Import integrity check failed.")
    }
    await assertCleanAfterOperation(`import-${options.mode}`)
  } catch (err) {
    await restoreDatabaseSnapshot(snapshot)
    throw err
  }
}

export function exportExpensesCsv(
  expenses: {
    title: string
    amountPaise: number
    categoryId: string
    date: string
    notes?: string
  }[],
  categoryNames: Record<string, string>
): void {
  const header = "Title,Amount,Category,Date,Notes"
  const rows = expenses.map((e) =>
    [
      `"${e.title.replace(/"/g, '""')}"`,
      (e.amountPaise / 100).toFixed(2),
      `"${(categoryNames[e.categoryId] ?? e.categoryId).replace(/"/g, '""')}"`,
      e.date,
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  )
  const csv = [header, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
