import { z } from "zod"
import { db, SCHEMA_VERSION, type AuthUser } from "@/lib/db"

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  scope: z.enum(["global", "group", "private"]),
  groupId: z.string().optional(),
  ownerUserId: z.string().optional(),
  isArchived: z.boolean(),
  createdAt: z.string(),
})

const personalExpenseSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  title: z.string(),
  amountPaise: z.number().int().nonnegative(),
  categoryId: z.string(),
  date: z.string(),
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
  createdByUserId: z.string(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const groupMemberSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  isActive: z.boolean(),
  joinedAt: z.string(),
})

const splitDataSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("equal_all") }),
  z.object({
    method: z.literal("equal_selected"),
    memberIds: z.array(z.string()),
  }),
  z.object({
    method: z.literal("manual"),
    shares: z.record(z.string(), z.number()),
  }),
  z.object({
    method: z.literal("percentage"),
    shares: z.record(z.string(), z.number()),
  }),
])

const groupExpenseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string(),
  amountPaise: z.number().int().nonnegative(),
  categoryId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
  paidByUserId: z.string(),
  splitMethod: z.enum(["equal_all", "equal_selected", "manual", "percentage"]),
  splitData: splitDataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

const settlementSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  amountPaise: z.number().int().nonnegative(),
  status: z.enum(["pending", "paid"]),
  paidAt: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
})

const exportSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  data: z.object({
    categories: z.array(categorySchema),
    personalExpenses: z.array(personalExpenseSchema),
    groups: z.array(groupSchema),
    groupMembers: z.array(groupMemberSchema),
    groupExpenses: z.array(groupExpenseSchema),
    settlements: z.array(settlementSchema),
  }),
})

export type ExportPayload = z.infer<typeof exportSchema>

export async function exportAllData(): Promise<ExportPayload> {
  const [categories, personalExpenses, groups, groupMembers, groupExpenses, settlements] =
    await Promise.all([
      db.categories.toArray(),
      db.personalExpenses.toArray(),
      db.groups.toArray(),
      db.groupMembers.toArray(),
      db.groupExpenses.toArray(),
      db.settlements.toArray(),
    ])

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      categories,
      personalExpenses,
      groups,
      groupMembers,
      groupExpenses,
      settlements,
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
  const parsed = JSON.parse(content)
  return exportSchema.parse(parsed)
}

export async function importAllData(
  payload: ExportPayload,
  options: { replace: boolean; newUser?: AuthUser }
): Promise<void> {
  exportSchema.parse(payload)

  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error("Backup was created with a newer app version.")
  }

  const data = payload.data

  await db.transaction(
    "rw",
    [
      db.categories,
      db.personalExpenses,
      db.groups,
      db.groupMembers,
      db.groupExpenses,
      db.settlements,
      db.appMeta,
    ],
    async () => {
      if (options.replace) {
        await Promise.all([
          db.categories.clear(),
          db.personalExpenses.clear(),
          db.groups.clear(),
          db.groupMembers.clear(),
          db.groupExpenses.clear(),
          db.settlements.clear(),
        ])
      }

      if (data.categories.length) await db.categories.bulkPut(data.categories)
      if (data.personalExpenses.length) await db.personalExpenses.bulkPut(data.personalExpenses)
      if (data.groups.length) await db.groups.bulkPut(data.groups)
      if (data.groupMembers.length) await db.groupMembers.bulkPut(data.groupMembers)
      if (data.groupExpenses.length) await db.groupExpenses.bulkPut(data.groupExpenses)
      if (data.settlements.length) await db.settlements.bulkPut(data.settlements)

      await db.appMeta.put({
        id: "meta",
        schemaVersion: SCHEMA_VERSION,
        lastExportAt: payload.exportedAt,
      })
    }
  )

  void options.newUser
}

export function exportExpensesCsv(
  expenses: { title: string; amountPaise: number; categoryId: string; date: string; notes?: string }[],
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
