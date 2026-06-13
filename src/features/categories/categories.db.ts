import { db, type Category, type CategoryScope } from "@/lib/db"

export async function getCategoriesForUser(
  accountId: string,
  groupId?: string
): Promise<Category[]> {
  const all = await db.categories.filter((c) => !c.isArchived).toArray()
  return all.filter((c) => {
    if (c.scope === "global") return true
    if (c.scope === "personal") return c.ownerAccountId === accountId
    if (c.scope === "group") return groupId && c.groupId === groupId
    return false
  })
}

export async function addCategory(input: {
  name: string
  scope: CategoryScope
  ownerAccountId?: string
  groupId?: string
  color?: string
  emoji?: string
  icon?: string
}): Promise<Category> {
  const now = new Date().toISOString()
  const category: Category = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    scope: input.scope,
    ownerAccountId: input.ownerAccountId,
    groupId: input.groupId,
    color: input.color,
    emoji: input.emoji ?? "📁",
    icon: input.icon,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.categories.add(category)
  return category
}

export async function updateCategory(
  id: string,
  changes: Partial<Pick<Category, "name" | "color" | "emoji" | "icon">>
): Promise<void> {
  await db.categories.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function archiveCategory(id: string): Promise<void> {
  await db.categories.update(id, { isArchived: true, updatedAt: new Date().toISOString() })
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) throw new Error("Category not found.")
  if (category.scope === "global") {
    throw new Error("System categories cannot be deleted.")
  }
  const usedInPersonal = await db.personalExpenses.where("categoryId").equals(id).count()
  const usedInTransactions = await db.transactions.where("categoryId").equals(id).count()
  if (usedInPersonal > 0 || usedInTransactions > 0) {
    throw new Error("Category is in use and cannot be deleted. Archive it instead.")
  }
  await db.categories.delete(id)
}

export async function getCategoryMap(ids?: string[]): Promise<Record<string, Category>> {
  const categories = ids ? await db.categories.bulkGet(ids) : await db.categories.toArray()
  const map: Record<string, Category> = {}
  for (const cat of categories) {
    if (cat) map[cat.id] = cat
  }
  return map
}

export function formatCategoryLabel(category: Category): string {
  return `${category.emoji ?? "📁"} ${category.name}`
}
