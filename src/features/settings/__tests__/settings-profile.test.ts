import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/lib/db"
import { getAccount, updateAccount } from "@/features/accounts/accounts.db"

// Feature: splitxl-incremental-changes, Property 1: Profile save persists all fields
// Validates: Requirements 1.2

function randomString(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

async function seedAccount(id: string, displayName: string) {
  await db.accounts.put({
    id,
    displayName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

describe("Profile save persists all fields (Property 1)", () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it("persists displayName, email, and phone to the database for any valid profile input", async () => {
    // Generate 20 random valid profile cases
    const cases = Array.from({ length: 20 }, () => ({
      accountId: crypto.randomUUID(),
      displayName: randomString("User"),
      email: `${randomString("user")}@example.com`,
      phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    }))

    for (const tc of cases) {
      await seedAccount(tc.accountId, "Initial Name")

      // Simulate what handleSaveProfile does
      await updateAccount(tc.accountId, {
        displayName: tc.displayName,
        email: tc.email,
        phone: tc.phone,
      })

      const saved = await getAccount(tc.accountId)
      expect(saved?.displayName).toBe(tc.displayName)
      expect(saved?.email).toBe(tc.email)
      expect(saved?.phone).toBe(tc.phone)
    }
  })

  it("persists displayName with only email (no phone) for any valid profile input", async () => {
    const cases = Array.from({ length: 20 }, () => ({
      accountId: crypto.randomUUID(),
      displayName: randomString("User"),
      email: `${randomString("user")}@example.com`,
    }))

    for (const tc of cases) {
      await seedAccount(tc.accountId, "Initial Name")

      await updateAccount(tc.accountId, {
        displayName: tc.displayName,
        email: tc.email,
        phone: undefined,
      })

      const saved = await getAccount(tc.accountId)
      expect(saved?.displayName).toBe(tc.displayName)
      expect(saved?.email).toBe(tc.email)
    }
  })

  it("persists displayName with only phone (no email) for any valid profile input", async () => {
    const cases = Array.from({ length: 20 }, () => ({
      accountId: crypto.randomUUID(),
      displayName: randomString("User"),
      phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    }))

    for (const tc of cases) {
      await seedAccount(tc.accountId, "Initial Name")

      await updateAccount(tc.accountId, {
        displayName: tc.displayName,
        email: undefined,
        phone: tc.phone,
      })

      const saved = await getAccount(tc.accountId)
      expect(saved?.displayName).toBe(tc.displayName)
      expect(saved?.phone).toBe(tc.phone)
    }
  })
})
