import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/lib/db"
import { validateDatabaseIntegrity } from "@/lib/db-integrity"

describe("db integrity", () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it("reports valid empty database", async () => {
    const report = await validateDatabaseIntegrity()
    expect(report.valid).toBe(true)
    expect(report.issues).toHaveLength(0)
  })
})
