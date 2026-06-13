import { describe, it, expect } from "vitest"
import { migrateExportToCurrent, buildImportPreview } from "@/lib/export-import"

describe("export-import", () => {
  it("migrates v1 export format", () => {
    const v1 = {
      schemaVersion: 1,
      exportedAt: "2024-01-01T00:00:00.000Z",
      data: {
        categories: [
          {
            id: "c1",
            name: "Food",
            scope: "global" as const,
            isArchived: false,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        personalExpenses: [],
        groups: [],
        groupMembers: [],
        groupExpenses: [],
        settlements: [],
      },
    }
    const migrated = migrateExportToCurrent(v1)
    expect(migrated.data.categories[0].scope).toBe("global")
    expect(migrated.data.transactions).toEqual([])
  })

  it("builds import preview", () => {
    const preview = buildImportPreview({
      exportVersion: 2,
      schemaVersion: 5,
      exportedAt: "2024-01-01T00:00:00.000Z",
      account: {
        id: "a1",
        displayName: "Akshay",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      data: {
        categories: [],
        personalExpenses: [],
        groups: [{ id: "g1", name: "Trip", createdByAccountId: "a1", status: "active", createdAt: "", updatedAt: "" }],
        groupMembers: [],
        transactions: [],
      },
    })
    expect(preview.accountName).toBe("Akshay")
    expect(preview.groups).toBe(1)
  })
})
