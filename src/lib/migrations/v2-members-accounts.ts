import type { UpgradeTx } from "@/lib/migrations/types"

interface LegacyMember {
  id: string
  groupId: string
  userId?: string
  displayName: string
  isActive: boolean
  joinedAt?: string
  createdAt?: string
  updatedAt?: string
}

function readAuthFromStorage(): { userId: string; displayName: string } | null {
  try {
    const raw = localStorage.getItem("auth_user")
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { user?: { userId?: string; accountId?: string; displayName?: string } } }
    const user = parsed.state?.user
    if (!user) return null
    const userId = user.accountId ?? user.userId
    if (!userId || !user.displayName) return null
    return { userId, displayName: user.displayName }
  } catch {
    return null
  }
}

function remapSplitDataKeys(
  splitData: Record<string, unknown>,
  userIdToMemberId: Map<string, string>
): Record<string, unknown> {
  const method = splitData.method as string
  if (method === "equal_all") return splitData
  if (method === "equal_selected") {
    const memberIds = (splitData.memberIds as string[]).map(
      (uid) => userIdToMemberId.get(uid) ?? uid
    )
    return { ...splitData, memberIds }
  }
  if (method === "manual" || method === "percentage") {
    const shares = splitData.shares as Record<string, number>
    const remapped: Record<string, number> = {}
    for (const [uid, val] of Object.entries(shares)) {
      remapped[userIdToMemberId.get(uid) ?? uid] = val
    }
    return { ...splitData, shares: remapped }
  }
  return splitData
}

export async function migrateV2(tx: UpgradeTx): Promise<void> {
  const now = new Date().toISOString()
  const auth = readAuthFromStorage()
  let accountId = auth?.userId ?? crypto.randomUUID()

  const existingAccounts = await tx.table("accounts").toArray()
  if (existingAccounts.length === 0) {
    await tx.table("accounts").put({
      id: accountId,
      displayName: auth?.displayName ?? "User",
      createdAt: now,
      updatedAt: now,
    })
  } else {
    accountId = (existingAccounts[0] as { id: string }).id
  }

  const members = (await tx.table("groupMembers").toArray()) as unknown as LegacyMember[]
  const userIdToMemberId = new Map<string, string>()

  for (const member of members) {
    const oldUserId = member.userId ?? member.id
    userIdToMemberId.set(oldUserId, member.id)

    const joinedAt = member.joinedAt ?? member.createdAt ?? now
    await tx.table("groupMembers").put({
      id: member.id,
      groupId: member.groupId,
      displayName: member.displayName,
      isActive: member.isActive,
      linkedAccountId: oldUserId === accountId ? accountId : undefined,
      createdAt: joinedAt,
      updatedAt: now,
    })
  }

  const expenses = await tx.table("groupExpenses").toArray()
  for (const expense of expenses) {
    const paidBy = expense.paidByUserId as string
    await tx.table("groupExpenses").put({
      ...expense,
      paidByUserId: userIdToMemberId.get(paidBy) ?? paidBy,
      splitData: remapSplitDataKeys(expense.splitData as Record<string, unknown>, userIdToMemberId),
    })
  }

  const settlements = await tx.table("settlements").toArray()
  for (const record of settlements) {
    const from = record.fromUserId as string
    const to = record.toUserId as string
    await tx.table("settlements").put({
      ...record,
      fromUserId: userIdToMemberId.get(from) ?? from,
      toUserId: userIdToMemberId.get(to) ?? to,
    })
  }
}
