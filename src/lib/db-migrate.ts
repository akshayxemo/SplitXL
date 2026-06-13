import { db, SCHEMA_VERSION, type Category } from "@/lib/db"

const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Food", emoji: "🍔", scope: "global", isArchived: false },
  { name: "Transport", emoji: "🚕", scope: "global", isArchived: false },
  { name: "Hotel", emoji: "🏨", scope: "global", isArchived: false },
  { name: "Tickets", emoji: "🎟️", scope: "global", isArchived: false },
  { name: "Shopping", emoji: "🛒", scope: "global", isArchived: false },
  { name: "Entertainment", emoji: "🎮", scope: "global", isArchived: false },
  { name: "Medical", emoji: "💊", scope: "global", isArchived: false },
  { name: "Rent", emoji: "🏠", scope: "global", isArchived: false },
  { name: "Education", emoji: "📚", scope: "global", isArchived: false },
  { name: "Travel", emoji: "✈️", scope: "global", isArchived: false },
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
