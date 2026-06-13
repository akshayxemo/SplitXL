import { db, SCHEMA_VERSION, type Category } from "@/lib/db"

const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Food", emoji: "🍔", icon: "utensils", color: "#f97316", scope: "global", isArchived: false },
  { name: "Transport", emoji: "🚕", icon: "car", color: "#3b82f6", scope: "global", isArchived: false },
  { name: "Shopping", emoji: "🛍️", icon: "shopping-bag", color: "#a855f7", scope: "global", isArchived: false },
  { name: "Entertainment", emoji: "🎟️", icon: "film", color: "#ec4899", scope: "global", isArchived: false },
  { name: "Bills", emoji: "📄", icon: "receipt", color: "#64748b", scope: "global", isArchived: false },
  { name: "Health", emoji: "❤️", icon: "heart-pulse", color: "#ef4444", scope: "global", isArchived: false },
  { name: "Other", emoji: "📦", icon: "circle", color: "#6b7280", scope: "global", isArchived: false },
]

export async function initializeDatabase(): Promise<void> {
  const meta = await db.appMeta.get("meta")

  if (!meta) {
    const now = new Date().toISOString()
    await db.transaction("rw", db.appMeta, db.categories, async () => {
      await db.appMeta.add({ id: "meta", schemaVersion: SCHEMA_VERSION })
      await db.categories.bulkAdd(
        DEFAULT_CATEGORIES.map((cat) => ({
          ...cat,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        }))
      )
    })
  } else if (meta.schemaVersion !== SCHEMA_VERSION) {
    await db.appMeta.update("meta", { schemaVersion: SCHEMA_VERSION })
  }
}

export async function syncAuthAccount(accountId: string, displayName: string): Promise<void> {
  const existing = await db.accounts.get(accountId)
  const now = new Date().toISOString()
  if (!existing) {
    await db.transaction("rw", db.accounts, db.settings, async () => {
      await db.accounts.add({
        id: accountId,
        displayName,
        createdAt: now,
        updatedAt: now,
      })
      await db.settings.put({ id: accountId, updatedAt: now })
    })
  } else if (existing.displayName !== displayName) {
    await db.accounts.update(accountId, { displayName, updatedAt: now })
  }
}
