import type {
  GroupExpense,
  GroupMember,
  SettlementRecord,
  SimplifiedDebt,
  SplitData,
} from "@/lib/db"
import { sumPaise } from "@/lib/money"

export function computeShares(
  expense: GroupExpense,
  members: GroupMember[]
): Record<string, number> {
  const activeMembers = members.filter((m) => m.isActive)
  const shares: Record<string, number> = {}

  for (const member of activeMembers) {
    shares[member.userId] = 0
  }

  const { amountPaise, splitData } = expense

  switch (splitData.method) {
    case "equal_all": {
      if (activeMembers.length === 0) return shares
      const perPerson = Math.floor(amountPaise / activeMembers.length)
      let remainder = amountPaise - perPerson * activeMembers.length
      for (const member of activeMembers) {
        shares[member.userId] = perPerson + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder--
      }
      break
    }
    case "equal_selected": {
      const selected = activeMembers.filter((m) =>
        splitData.memberIds.includes(m.userId)
      )
      if (selected.length === 0) return shares
      const perPerson = Math.floor(amountPaise / selected.length)
      let remainder = amountPaise - perPerson * selected.length
      for (const member of selected) {
        shares[member.userId] = perPerson + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder--
      }
      break
    }
    case "manual": {
      for (const [userId, amount] of Object.entries(splitData.shares)) {
        if (userId in shares) shares[userId] = amount
      }
      break
    }
    case "percentage": {
      const entries = Object.entries(splitData.shares)
      let allocated = 0
      for (let i = 0; i < entries.length; i++) {
        const [userId, pct] = entries[i]
        if (!(userId in shares)) continue
        if (i === entries.length - 1) {
          shares[userId] = amountPaise - allocated
        } else {
          const share = Math.round((amountPaise * pct) / 100)
          shares[userId] = share
          allocated += share
        }
      }
      break
    }
  }

  return shares
}

export function computeNetBalances(
  expenses: GroupExpense[],
  members: GroupMember[]
): Record<string, number> {
  const balances: Record<string, number> = {}

  for (const member of members.filter((m) => m.isActive)) {
    balances[member.userId] = 0
  }

  for (const expense of expenses) {
    const shares = computeShares(expense, members)
    balances[expense.paidByUserId] =
      (balances[expense.paidByUserId] ?? 0) + expense.amountPaise

    for (const [userId, share] of Object.entries(shares)) {
      balances[userId] = (balances[userId] ?? 0) - share
    }
  }

  return balances
}

export function simplifyDebts(balances: Record<string, number>): SimplifiedDebt[] {
  const creditors: { userId: string; amount: number }[] = []
  const debtors: { userId: string; amount: number }[] = []

  for (const [userId, balance] of Object.entries(balances)) {
    if (balance > 0) creditors.push({ userId, amount: balance })
    else if (balance < 0) debtors.push({ userId, amount: -balance })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const debts: SimplifiedDebt[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount)
    if (amount > 0) {
      debts.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amountPaise: amount,
      })
    }
    debtors[i].amount -= amount
    creditors[j].amount -= amount
    if (debtors[i].amount === 0) i++
    if (creditors[j].amount === 0) j++
  }

  return debts
}

export function applyPaidSettlements(
  debts: SimplifiedDebt[],
  paidRecords: SettlementRecord[]
): SimplifiedDebt[] {
  const remaining = debts.map((d) => ({ ...d }))

  for (const record of paidRecords.filter((r) => r.status === "paid")) {
    let left = record.amountPaise
    for (const debt of remaining) {
      if (
        left <= 0 ||
        debt.fromUserId !== record.fromUserId ||
        debt.toUserId !== record.toUserId
      ) {
        continue
      }
      const applied = Math.min(debt.amountPaise, left)
      debt.amountPaise -= applied
      left -= applied
    }
  }

  return remaining.filter((d) => d.amountPaise > 0)
}

export function validateSplitData(
  amountPaise: number,
  splitData: SplitData,
  memberIds: string[]
): string | null {
  switch (splitData.method) {
    case "equal_all":
    case "equal_selected":
      if (splitData.method === "equal_selected" && splitData.memberIds.length === 0) {
        return "Select at least one member."
      }
      return null
    case "manual": {
      const total = sumPaise(Object.values(splitData.shares))
      if (total !== amountPaise) {
        return `Manual shares must sum to ${amountPaise / 100} (got ${total / 100}).`
      }
      for (const id of Object.keys(splitData.shares)) {
        if (!memberIds.includes(id)) return "Invalid member in manual split."
      }
      return null
    }
    case "percentage": {
      const total = Object.values(splitData.shares).reduce((s, v) => s + v, 0)
      if (Math.abs(total - 100) > 0.01) {
        return "Percentages must sum to 100%."
      }
      return null
    }
    default:
      return null
  }
}

export function getMemberDisplayName(
  members: GroupMember[],
  userId: string
): string {
  return members.find((m) => m.userId === userId)?.displayName ?? userId
}
