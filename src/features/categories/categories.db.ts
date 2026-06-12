import { db, type Category, type CategoryScope } from "@/lib/db"

export async function getCategoriesForUser(
  userId: string,
  groupId?: string
): Promise<Category[]> {
  const all = await db.categories.filter((c) => !c.isArchived).toArray()
  return all.filter((c) => {
    if (c.scope === "global") return true
    if (c.scope === "private") return c.ownerUserId === userId
    if (c.scope === "group") return groupId && c.groupId === groupId
    return false
  })
}

export async function addCategory(input: {
  name: string
  scope: CategoryScope
  ownerUserId?: string
  groupId?: string
  color?: string
  icon?: string
}): Promise<Category> {
  const category: Category = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    scope: input.scope,
    ownerUserId: input.ownerUserId,
    groupId: input.groupId,
    color: input.color,
    icon: input.icon,
    isArchived: false,
    createdAt: new Date().toISOString(),
  }
  await db.categories.add(category)
  return category
}

export async function updateCategory(
  id: string,
  changes: Partial<Pick<Category, "name" | "color" | "icon">>
): Promise<void> {
  await db.categories.update(id, changes)
}

export async function archiveCategory(id: string): Promise<void> {
  await db.categories.update(id, { isArchived: true })
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
}

export async function getCategoryMap(ids?: string[]): Promise<Record<string, Category>> {
  const categories = ids
    ? await db.categories.bulkGet(ids)
    : await db.categories.toArray()
  const map: Record<string, Category> = {}
  for (const cat of categories) {
    if (cat) map[cat.id] = cat
  }
  return map
}
