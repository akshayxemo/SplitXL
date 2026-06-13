import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/lib/db"
import { validateDatabaseIntegrity } from "@/lib/db-integrity"
import { computeNetBalances, simplifyDebts } from "@/lib/settlement"
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

describe("db integrity", () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it("reports valid empty database", async () => {
    const report = await validateDatabaseIntegrity()
    expect(report.valid).toBe(true)
  })
})
