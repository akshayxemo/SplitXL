import { describe, it, expect } from "vitest"
import { computeNetBalances, computeSettlementProgress, simplifyDebts } from "@/lib/settlement"
import type { GroupMember, Transaction } from "@/lib/db"

describe("settlement engine", () => {
  const members: GroupMember[] = [
    {
      id: "m1",
      groupId: "g1",
      displayName: "Alice",
      linkedAccountId: "a1",
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "m2",
      groupId: "g1",
      displayName: "Bob",
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ]

  it("computes equal split balances", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        groupId: "g1",
        type: "expense",
        title: "Dinner",
        amountPaise: 10000,
        categoryId: "c1",
        paidByMemberId: "m1",
        splitMethod: "equal_all",
        splitData: { method: "equal_all" },
        transactionDateTime: "2024-01-01T12:00:00.000Z",
        createdAt: "2024-01-01T12:00:00.000Z",
        updatedAt: "2024-01-01T12:00:00.000Z",
      },
    ]
    const balances = computeNetBalances(transactions, members)
    expect(balances.m1).toBe(5000)
    expect(balances.m2).toBe(-5000)
    const debts = simplifyDebts(balances)
    expect(debts).toHaveLength(1)
    expect(debts[0].fromMemberId).toBe("m2")
    expect(debts[0].toMemberId).toBe("m1")
  })

  // Feature: splitxl-incremental-changes, Property 5: Settlement progress calculation is consistent
  // Validates: Requirements 5.4
  it("settlement progress completionPct equals settledAmount / totalDebt * 100", () => {
    type TestCase = {
      expenseAmounts: number[]
      settlementAmounts: number[]
    }

    const cases: TestCase[] = [
      // No expenses, no settlements → totalDebt 0 → completionPct 100
      { expenseAmounts: [], settlementAmounts: [] },
      // Partially settled
      { expenseAmounts: [10000], settlementAmounts: [2500] },
      // Over-settled (capped at 100)
      { expenseAmounts: [10000], settlementAmounts: [9000] },
      // Multiple expenses, no settlements
      { expenseAmounts: [5000, 8000, 3000], settlementAmounts: [] },
      // Multiple expenses, multiple settlements
      { expenseAmounts: [5000, 8000, 3000], settlementAmounts: [1000, 2000] },
      // Settlement exactly equals total debt
      { expenseAmounts: [20000], settlementAmounts: [10000] },
      // Large amounts
      { expenseAmounts: [1000000, 500000], settlementAmounts: [300000, 200000] },
    ]

    for (const tc of cases) {
      const transactions: Transaction[] = [
        ...tc.expenseAmounts.map((amount, i) => ({
          id: `e${i}`,
          groupId: "g1",
          type: "expense" as const,
          title: `Expense ${i}`,
          amountPaise: amount,
          categoryId: "c1",
          paidByMemberId: "m1",
          splitMethod: "equal_all" as const,
          splitData: { method: "equal_all" as const },
          transactionDateTime: "2024-01-01T12:00:00.000Z",
          createdAt: "2024-01-01T12:00:00.000Z",
          updatedAt: "2024-01-01T12:00:00.000Z",
        })),
        ...tc.settlementAmounts.map((amount, i) => ({
          id: `s${i}`,
          groupId: "g1",
          type: "settlement_payment" as const,
          title: `Settlement ${i}`,
          amountPaise: amount,
          paidByMemberId: "m2",
          settlementFromMemberId: "m2",
          settlementToMemberId: "m1",
          splitMethod: "equal_all" as const,
          splitData: { method: "equal_all" as const },
          transactionDateTime: "2024-01-02T12:00:00.000Z",
          createdAt: "2024-01-02T12:00:00.000Z",
          updatedAt: "2024-01-02T12:00:00.000Z",
        })),
      ]

      const result = computeSettlementProgress(transactions, members)

      // Core formula: completionPct = settledAmount / totalDebt * 100 (edge: totalDebt=0 → 100%)
      if (result.totalDebt === 0) {
        expect(result.completionPct).toBe(100)
      } else {
        const expectedPct = Math.min(100, (result.settledAmount / result.totalDebt) * 100)
        expect(result.completionPct).toBeCloseTo(expectedPct, 5)
      }

      // remainingAmount invariant: max(0, totalDebt - settledAmount)
      const expectedRemaining = Math.max(0, result.totalDebt - result.settledAmount)
      expect(result.remainingAmount).toBe(expectedRemaining)

      // settledAmount = sum of all settlement_payment transaction amounts
      const expectedSettled = tc.settlementAmounts.reduce((s, a) => s + a, 0)
      expect(result.settledAmount).toBe(expectedSettled)
    }
  })

  it("refunds reduce balances", () => {
    const transactions: Transaction[] = [
      {
        id: "t1",
        groupId: "g1",
        type: "expense",
        title: "Dinner",
        amountPaise: 10000,
        categoryId: "c1",
        paidByMemberId: "m1",
        splitMethod: "equal_all",
        splitData: { method: "equal_all" },
        transactionDateTime: "2024-01-01T12:00:00.000Z",
        createdAt: "2024-01-01T12:00:00.000Z",
        updatedAt: "2024-01-01T12:00:00.000Z",
      },
      {
        id: "t2",
        groupId: "g1",
        type: "refund",
        title: "Refund",
        amountPaise: 10000,
        paidByMemberId: "m1",
        splitMethod: "equal_all",
        splitData: { method: "equal_all" },
        refundOfTransactionId: "t1",
        transactionDateTime: "2024-01-02T12:00:00.000Z",
        createdAt: "2024-01-02T12:00:00.000Z",
        updatedAt: "2024-01-02T12:00:00.000Z",
      },
    ]
    const balances = computeNetBalances(transactions, members)
    expect(balances.m1).toBe(0)
    expect(balances.m2).toBe(0)
  })
})
