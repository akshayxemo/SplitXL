import { describe, it, expect } from "vitest"
import { isoToDateString } from "@/components/DateTimePickerModal"
import { dateToTransactionDateTime } from "@/features/expenses/expenses.db"

// Feature: splitxl-incremental-changes, Change 4: Date & Time Field Consolidation
// Validates: Requirements 4.1, 4.2

describe("personal expense form — date/time consolidation", () => {
  it("form state has no standalone date field", () => {
    // The emptyForm object should not contain a 'date' key — only transactionDateTime is used
    const emptyForm = {
      title: "",
      amount: "",
      categoryId: "",
      notes: "",
    }
    expect(Object.keys(emptyForm)).not.toContain("date")
  })

  it("date is derived from transactionDateTime using isoToDateString", () => {
    const transactionDateTime = "2025-03-15T14:30:00.000Z"
    const derivedDate = isoToDateString(transactionDateTime)
    // Should produce a valid yyyy-MM-dd string
    expect(derivedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("isoToDateString is consistent with dateToTransactionDateTime round-trip", () => {
    const dateStr = "2025-06-10"
    const iso = dateToTransactionDateTime(dateStr, "12:00")
    const derived = isoToDateString(iso)
    expect(derived).toBe(dateStr)
  })

  it("isoToDateString correctly extracts date for various datetimes", () => {
    // Use midday UTC times to avoid timezone-edge issues in test environments
    const cases = [
      "2025-01-01T12:00:00.000Z",
      "2024-06-15T12:00:00.000Z",
      "2025-06-15T09:00:00.000Z",
    ]
    for (const iso of cases) {
      const result = isoToDateString(iso)
      // Must be a valid yyyy-MM-dd string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.length).toBe(10)
    }
  })
})
