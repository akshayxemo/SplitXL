import { db, SCHEMA_VERSION, type Category } from "@/lib/db"

const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  { name: "Food", icon: "utensils", color: "#f97316", scope: "global", isArchived: false },
  { name: "Transport", icon: "car", color: "#3b82f6", scope: "global", isArchived: false },
  { name: "Shopping", icon: "shopping-bag", color: "#a855f7", scope: "global", isArchived: false },
  { name: "Entertainment", icon: "film", color: "#ec4899", scope: "global", isArchived: false },
  { name: "Bills", icon: "receipt", color: "#64748b", scope: "global", isArchived: false },
  { name: "Health", icon: "heart-pulse", color: "#ef4444", scope: "global", isArchived: false },
  { name: "Other", icon: "circle", color: "#6b7280", scope: "global", isArchived: false },
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
        }))
      )
    })
  }
}
