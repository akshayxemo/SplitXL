import type { Transaction, GroupMember, SplitData } from "@/lib/db"
import { sumPaise } from "@/lib/money"

export function computeShares(
  transaction: Transaction,
  members: GroupMember[]
): Record<string, number> {
  const activeMembers = members.filter((m) => m.isActive)
  const shares: Record<string, number> = {}

  for (const member of activeMembers) {
    shares[member.id] = 0
  }

  if (transaction.type === "settlement_payment" || !transaction.splitData) {
    return shares
  }

  const { amountPaise, splitData } = transaction

  switch (splitData.method) {
    case "equal_all": {
      if (activeMembers.length === 0) return shares
      const perPerson = Math.floor(amountPaise / activeMembers.length)
      let remainder = amountPaise - perPerson * activeMembers.length
      for (const member of activeMembers) {
        shares[member.id] = perPerson + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder--
      }
      break
    }
    case "equal_selected": {
      const selected = activeMembers.filter((m) => splitData.memberIds.includes(m.id))
      if (selected.length === 0) return shares
      const perPerson = Math.floor(amountPaise / selected.length)
      let remainder = amountPaise - perPerson * selected.length
      for (const member of selected) {
        shares[member.id] = perPerson + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder--
      }
      break
    }
    case "manual": {
      for (const [memberId, amount] of Object.entries(splitData.shares)) {
        if (memberId in shares) shares[memberId] = amount
      }
      break
    }
    case "percentage": {
      const entries = Object.entries(splitData.shares)
      let allocated = 0
      for (let i = 0; i < entries.length; i++) {
        const [memberId, pct] = entries[i]
        if (!(memberId in shares)) continue
        if (i === entries.length - 1) {
          shares[memberId] = amountPaise - allocated
        } else {
          const share = Math.round((amountPaise * pct) / 100)
          shares[memberId] = share
          allocated += share
        }
      }
      break
    }
  }

  return shares
}

function applyTransactionToBalances(
  transaction: Transaction,
  members: GroupMember[],
  balances: Record<string, number>
): void {
  if (transaction.type === "settlement_payment") {
    const from = transaction.settlementFromMemberId ?? transaction.paidByMemberId
    const to = transaction.settlementToMemberId
    if (from && to) {
      balances[from] = (balances[from] ?? 0) + transaction.amountPaise
      balances[to] = (balances[to] ?? 0) - transaction.amountPaise
    }
    return
  }

  const shares = computeShares(transaction, members)
  const sign = transaction.type === "refund" ? -1 : 1
  const amount = transaction.amountPaise * sign

  balances[transaction.paidByMemberId] =
    (balances[transaction.paidByMemberId] ?? 0) + amount

  for (const [memberId, share] of Object.entries(shares)) {
    balances[memberId] = (balances[memberId] ?? 0) - share * sign
  }
}

export function computeNetBalances(
  transactions: Transaction[],
  members: GroupMember[]
): Record<string, number> {
  const balances: Record<string, number> = {}

  for (const member of members.filter((m) => m.isActive)) {
    balances[member.id] = 0
  }

  for (const transaction of transactions) {
    applyTransactionToBalances(transaction, members, balances)
  }

  return balances
}

export function simplifyDebts(
  balances: Record<string, number>
): { fromMemberId: string; toMemberId: string; amountPaise: number }[] {
  const creditors: { memberId: string; amount: number }[] = []
  const debtors: { memberId: string; amount: number }[] = []

  for (const [memberId, balance] of Object.entries(balances)) {
    if (balance > 0) creditors.push({ memberId, amount: balance })
    else if (balance < 0) debtors.push({ memberId, amount: -balance })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const debts: { fromMemberId: string; toMemberId: string; amountPaise: number }[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount)
    if (amount > 0) {
      debts.push({
        fromMemberId: debtors[i].memberId,
        toMemberId: creditors[j].memberId,
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

export function getMemberDisplayName(members: GroupMember[], memberId: string): string {
  return members.find((m) => m.id === memberId)?.displayName ?? memberId
}

export function sumExpenseTransactions(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amountPaise, 0)
}
