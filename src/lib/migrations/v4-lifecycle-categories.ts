const ICON_EMOJI: Record<string, string> = {
  utensils: "🍔",
  car: "🚕",
  "shopping-bag": "🛍️",
  film: "🎟️",
  receipt: "📄",
  "heart-pulse": "❤️",
  circle: "📦",
}

import type { UpgradeTx } from "@/lib/migrations/types"

export async function migrateV4(tx: UpgradeTx): Promise<void> {
  const now = new Date().toISOString()

  const groups = await tx.table("groups").toArray()
  for (const group of groups) {
    const isArchived = group.isArchived as boolean | undefined
    const existingStatus = group.status as string | undefined
    await tx.table("groups").put({
      id: group.id,
      name: group.name,
      description: group.description,
      budgetPaise: group.budgetPaise,
      createdByAccountId:
        (group.createdByAccountId as string | undefined) ?? (group.createdByUserId as string),
      status: existingStatus ?? (isArchived ? "archived" : "active"),
      settlementStartedAt: group.settlementStartedAt,
      settledAt: group.settledAt,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt ?? now,
    })
  }

  const categories = await tx.table("categories").toArray()
  for (const cat of categories) {
    const scope = cat.scope as string
    const icon = cat.icon as string | undefined
    await tx.table("categories").put({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji ?? (icon ? ICON_EMOJI[icon] : undefined) ?? "📁",
      icon: cat.icon,
      color: cat.color,
      scope: scope === "private" ? "personal" : scope,
      groupId: cat.groupId,
      ownerAccountId:
        (cat.ownerAccountId as string | undefined) ?? (cat.ownerUserId as string | undefined),
      isArchived: cat.isArchived,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt ?? (cat.createdAt as string),
    })
  }

  const personalExpenses = await tx.table("personalExpenses").toArray()
  for (const expense of personalExpenses) {
    await tx.table("personalExpenses").put({
      ...expense,
      ownerAccountId:
        (expense.ownerAccountId as string | undefined) ??
        (expense.ownerUserId as string | undefined),
    })
  }
}
