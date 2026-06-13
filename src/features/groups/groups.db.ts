import { db, type Group, type GroupMember } from "@/lib/db"
import {
  assertGroupAllowsGroupMutations,
  assertGroupAllowsMemberMutations,
  getGroupOrThrow,
} from "@/lib/group-guards"
import { validateContact } from "@/features/accounts/accounts.db"
import { addFriend } from "@/features/friends/friends.db"

export async function addGroup(input: {
  name: string
  description?: string
  budgetPaise?: number
  createdByAccountId: string
  creatorDisplayName: string
  creatorEmail?: string
  creatorPhone?: string
}): Promise<Group> {
  const now = new Date().toISOString()
  const groupId = crypto.randomUUID()

  await db.transaction("rw", db.groups, db.groupMembers, async () => {
    const group: Group = {
      id: groupId,
      name: input.name.trim(),
      description: input.description?.trim(),
      budgetPaise: input.budgetPaise,
      createdByAccountId: input.createdByAccountId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }
    await db.groups.add(group)
    await db.groupMembers.add({
      id: crypto.randomUUID(),
      groupId,
      displayName: input.creatorDisplayName,
      email: input.creatorEmail,
      phone: input.creatorPhone,
      linkedAccountId: input.createdByAccountId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  })

  return (await db.groups.get(groupId))!
}

export async function updateGroup(
  id: string,
  changes: Partial<Pick<Group, "name" | "description" | "budgetPaise">>
): Promise<void> {
  await assertGroupAllowsGroupMutations(id)
  await db.groups.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function archiveGroup(id: string): Promise<void> {
  const group = await getGroupOrThrow(id)
  if (group.status === "settlement_in_progress") {
    throw new Error("Cannot archive a group during settlement.")
  }
  await db.groups.update(id, { status: "archived", updatedAt: new Date().toISOString() })
}

export async function restoreGroup(id: string): Promise<void> {
  const group = await getGroupOrThrow(id)
  if (group.status !== "archived") throw new Error("Group is not archived.")
  await db.groups.update(id, { status: "active", updatedAt: new Date().toISOString() })
}

export async function deleteGroup(id: string): Promise<void> {
  const group = await getGroupOrThrow(id)
  if (group.status === "settlement_in_progress") {
    throw new Error("Cannot delete a group during settlement.")
  }
  await db.transaction("rw", db.groups, db.groupMembers, db.transactions, db.categories, async () => {
    await db.transactions.where("groupId").equals(id).delete()
    await db.groupMembers.where("groupId").equals(id).delete()
    await db.categories.filter((c) => c.groupId === id).delete()
    await db.groups.delete(id)
  })
}

export async function getGroupsForAccount(
  accountId: string,
  statusFilter?: Group["status"] | "all"
): Promise<Group[]> {
  const memberOf = await db.groupMembers
    .filter((m) => m.linkedAccountId === accountId && m.isActive)
    .toArray()
  const groupIds = [...new Set(memberOf.map((m) => m.groupId))]
  const groups = await db.groups.bulkGet(groupIds)
  return groups
    .filter((g): g is Group => !!g)
    .filter((g) => {
      if (statusFilter && statusFilter !== "all") return g.status === statusFilter
      return g.status !== "archived"
    })
    .sort((a, b) => {
      const order = { active: 0, settlement_in_progress: 1, settled: 2, archived: 3 }
      const diff = order[a.status] - order[b.status]
      return diff !== 0 ? diff : b.updatedAt.localeCompare(a.updatedAt)
    })
}

export async function getArchivedGroups(accountId: string): Promise<Group[]> {
  const memberOf = await db.groupMembers
    .filter((m) => m.linkedAccountId === accountId && m.isActive)
    .toArray()
  const groupIds = [...new Set(memberOf.map((m) => m.groupId))]
  const groups = await db.groups.bulkGet(groupIds)
  return groups.filter((g): g is Group => !!g && g.status === "archived")
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  return db.groupMembers.where("groupId").equals(groupId).toArray()
}

export async function addGroupMember(input: {
  groupId: string
  displayName: string
  email?: string
  phone?: string
  linkedFriendId?: string
  saveAsFriend?: boolean
  ownerAccountId?: string
}): Promise<GroupMember> {
  await assertGroupAllowsMemberMutations(input.groupId)
  const error = validateContact(input.email, input.phone)
  if (error && !input.linkedFriendId) {
    // Name-only members allowed without contact when not linking friend
  }

  let linkedFriendId = input.linkedFriendId
  if (input.saveAsFriend && input.ownerAccountId) {
    const friend = await addFriend({
      ownerAccountId: input.ownerAccountId,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
    })
    linkedFriendId = friend.id
  }

  const now = new Date().toISOString()
  const member: GroupMember = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    displayName: input.displayName.trim(),
    email: input.email?.trim(),
    phone: input.phone?.trim(),
    linkedFriendId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.groupMembers.add(member)
  return member
}

export async function addGroupMemberFromFriend(input: {
  groupId: string
  friendId: string
}): Promise<GroupMember> {
  await assertGroupAllowsMemberMutations(input.groupId)
  const friend = await db.friends.get(input.friendId)
  if (!friend || friend.isArchived) throw new Error("Friend not found.")

  const existing = await db.groupMembers
    .filter((m) => m.groupId === input.groupId && m.linkedFriendId === input.friendId && m.isActive)
    .first()
  if (existing) throw new Error("Friend is already a member of this group.")

  const now = new Date().toISOString()
  const member: GroupMember = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    displayName: friend.displayName,
    email: friend.email,
    phone: friend.phone,
    linkedFriendId: friend.id,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.groupMembers.add(member)
  return member
}

export async function removeGroupMember(id: string): Promise<void> {
  const member = await db.groupMembers.get(id)
  if (!member) return
  await assertGroupAllowsMemberMutations(member.groupId)
  await db.groupMembers.update(id, { isActive: false, updatedAt: new Date().toISOString() })
}

export async function startSettlement(groupId: string): Promise<void> {
  const group = await getGroupOrThrow(groupId)
  if (group.status !== "active") {
    throw new Error("Settlement can only be started on active groups.")
  }
  await db.groups.update(groupId, {
    status: "settlement_in_progress",
    settlementStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

export async function cancelSettlement(groupId: string): Promise<void> {
  const group = await getGroupOrThrow(groupId)
  if (group.status !== "settlement_in_progress") {
    throw new Error("Group is not in settlement.")
  }
  const payments = await db.transactions
    .where("groupId")
    .equals(groupId)
    .filter((t) => t.type === "settlement_payment")
    .count()
  if (payments > 0) {
    throw new Error("Cannot cancel settlement after payments have been recorded.")
  }
  await db.groups.update(groupId, {
    status: "active",
    settlementStartedAt: undefined,
    updatedAt: new Date().toISOString(),
  })
}

// Re-export transaction helpers for backward compat
export {
  addGroupExpense,
  deleteTransaction as deleteGroupExpense,
  getGroupExpenses,
  sumGroupExpenses,
  updateTransaction as updateGroupExpense,
} from "@/features/transactions/transactions.db"
