import { describe, it, expect, beforeEach } from "vitest"
import { db, type CategoryScope } from "@/lib/db"
import { addCategory, deleteCategory, formatCategoryLabel, updateCategory } from "@/features/categories/categories.db"

// Helpers
function randomId() {
  return crypto.randomUUID()
}

function randomName(seed: number) {
  const names = ["Food", "Travel", "Rent", "Medical", "Transport", "Education", "Shopping", "Fun", "Health", "Work"]
  return names[seed % names.length] + `-${seed}`
}

function randomEmoji(seed: number) {
  const emojis = ["🍔", "✈️", "🏠", "💊", "🚕", "📚", "🛒", "🎮", "💪", "💼"]
  return emojis[seed % emojis.length]
}

async function seedCategory(scope: CategoryScope, ownerAccountId?: string, groupId?: string) {
  return addCategory({
    name: `Test ${randomId()}`,
    emoji: "📁",
    scope,
    ownerAccountId,
    groupId,
  })
}

describe("categories", () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  // Feature: splitxl-incremental-changes, Property 3: Category edit accepts name and emoji for all scopes
  // Validates: Requirements 3.3, 3.6
  describe("Property 3: Category edit accepts name and emoji for all scopes", () => {
    const ITERATIONS = 50

    it("updates name and emoji for global scope categories", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const cat = await seedCategory("global")
        const newName = randomName(i)
        const newEmoji = randomEmoji(i)

        await updateCategory(cat.id, { name: newName, emoji: newEmoji })

        const updated = await db.categories.get(cat.id)
        expect(updated?.name).toBe(newName)
        expect(updated?.emoji).toBe(newEmoji)
      }
    })

    it("updates name and emoji for personal scope categories", async () => {
      const accountId = randomId()
      for (let i = 0; i < ITERATIONS; i++) {
        const cat = await seedCategory("personal", accountId)
        const newName = randomName(i + 100)
        const newEmoji = randomEmoji(i + 100)

        await updateCategory(cat.id, { name: newName, emoji: newEmoji })

        const updated = await db.categories.get(cat.id)
        expect(updated?.name).toBe(newName)
        expect(updated?.emoji).toBe(newEmoji)
      }
    })

    it("updates name and emoji for group scope categories", async () => {
      const groupId = randomId()
      for (let i = 0; i < ITERATIONS; i++) {
        const cat = await seedCategory("group", undefined, groupId)
        const newName = randomName(i + 200)
        const newEmoji = randomEmoji(i + 200)

        await updateCategory(cat.id, { name: newName, emoji: newEmoji })

        const updated = await db.categories.get(cat.id)
        expect(updated?.name).toBe(newName)
        expect(updated?.emoji).toBe(newEmoji)
      }
    })
  })

  // Feature: splitxl-incremental-changes, Property 4: System category deletion is rejected
  // Validates: Requirements 3.4
  describe("Property 4: System category deletion is rejected", () => {
    const ITERATIONS = 50

    it("rejects deleteCategory for any global scope category", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const cat = await seedCategory("global")

        await expect(deleteCategory(cat.id)).rejects.toThrow()

        // Category must remain unchanged in the database
        const stillExists = await db.categories.get(cat.id)
        expect(stillExists).toBeDefined()
        expect(stillExists?.scope).toBe("global")
      }
    })

    it("allows deleteCategory for personal scope categories", async () => {
      const accountId = randomId()
      for (let i = 0; i < ITERATIONS; i++) {
        const cat = await seedCategory("personal", accountId)

        await expect(deleteCategory(cat.id)).resolves.not.toThrow()

        const gone = await db.categories.get(cat.id)
        expect(gone).toBeUndefined()
      }
    })
  })

  // Feature: splitxl-incremental-changes, Property 10: Category label always includes emoji and name
  // Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
  describe("Property 10: Category label always includes emoji and name", () => {
    const ITERATIONS = 50

    it("formatCategoryLabel returns a string containing both emoji and name for any category", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const name = randomName(i)
        const emoji = randomEmoji(i)
        const cat = await addCategory({ name, emoji, scope: "global" })

        const label = formatCategoryLabel(cat)

        expect(label).toContain(emoji)
        expect(label).toContain(name)
      }
    })

    it("formatCategoryLabel falls back to 📁 when emoji is missing", async () => {
      const cat = await addCategory({ name: "NoEmoji", scope: "personal", ownerAccountId: randomId() })
      const catWithoutEmoji = { ...cat, emoji: undefined as unknown as string }
      const label = formatCategoryLabel(catWithoutEmoji)
      expect(label).toContain("📁")
      expect(label).toContain("NoEmoji")
    })
  })
})
