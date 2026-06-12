import { db, type Group, type GroupExpense, type GroupMember, type SplitData } from "@/lib/db"
import { validateSplitData } from "@/lib/settlement"

export async function addGroup(input: {
  name: string
  description?: string
  budgetPaise?: number
  createdByUserId: string
  creatorDisplayName: string
}): Promise<Group> {
  const now = new Date().toISOString()
  const groupId = crypto.randomUUID()

  await db.transaction("rw", db.groups, db.groupMembers, async () => {
    const group: Group = {
      id: groupId,
      name: input.name.trim(),
      description: input.description?.trim(),
      budgetPaise: input.budgetPaise,
      createdByUserId: input.createdByUserId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.groups.add(group)
    await db.groupMembers.add({
      id: crypto.randomUUID(),
      groupId,
      userId: input.createdByUserId,
      displayName: input.creatorDisplayName,
      isActive: true,
      joinedAt: now,
    })
  })

  return (await db.groups.get(groupId))!
}

export async function updateGroup(
  id: string,
  changes: Partial<Pick<Group, "name" | "description" | "budgetPaise">>
): Promise<void> {
  await db.groups.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function archiveGroup(id: string): Promise<void> {
  await db.groups.update(id, { isArchived: true, updatedAt: new Date().toISOString() })
}

export async function getActiveGroups(userId: string): Promise<Group[]> {
  const memberOf = await db.groupMembers.where("userId").equals(userId).toArray()
  const groupIds = [...new Set(memberOf.map((m) => m.groupId))]
  const groups = await db.groups.bulkGet(groupIds)
  return groups.filter((g): g is Group => !!g && !g.isArchived)
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  return db.groupMembers.where("groupId").equals(groupId).toArray()
}

export async function addGroupMember(input: {
  groupId: string
  displayName: string
}): Promise<GroupMember> {
  const member: GroupMember = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    userId: crypto.randomUUID(),
    displayName: input.displayName.trim(),
    isActive: true,
    joinedAt: new Date().toISOString(),
  }
  await db.groupMembers.add(member)
  return member
}

export async function removeGroupMember(id: string): Promise<void> {
  await db.groupMembers.update(id, { isActive: false })
}

export async function addGroupExpense(input: {
  groupId: string
  title: string
  amountPaise: number
  categoryId: string
  date: string
  notes?: string
  paidByUserId: string
  splitData: SplitData
}): Promise<GroupExpense> {
  const members = await getGroupMembers(input.groupId)
  const memberIds = members.filter((m) => m.isActive).map((m) => m.userId)
  const error = validateSplitData(input.amountPaise, input.splitData, memberIds)
  if (error) throw new Error(error)

  const now = new Date().toISOString()
  const expense: GroupExpense = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    title: input.title.trim(),
    amountPaise: input.amountPaise,
    categoryId: input.categoryId,
    date: input.date,
    notes: input.notes?.trim(),
    paidByUserId: input.paidByUserId,
    splitMethod: input.splitData.method,
    splitData: input.splitData,
    createdAt: now,
    updatedAt: now,
  }
  await db.groupExpenses.add(expense)
  return expense
}

export async function updateGroupExpense(
  id: string,
  changes: Partial<Omit<GroupExpense, "id" | "groupId" | "createdAt">>
): Promise<void> {
  if (changes.splitData && changes.amountPaise !== undefined) {
    const existing = await db.groupExpenses.get(id)
    if (existing) {
      const members = await getGroupMembers(existing.groupId)
      const memberIds = members.filter((m) => m.isActive).map((m) => m.userId)
      const error = validateSplitData(changes.amountPaise, changes.splitData, memberIds)
      if (error) throw new Error(error)
    }
  }
  await db.groupExpenses.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function deleteGroupExpense(id: string): Promise<void> {
  await db.groupExpenses.delete(id)
}

export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
  return db.groupExpenses.where("groupId").equals(groupId).sortBy("date")
}

export function sumGroupExpenses(expenses: GroupExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountPaise, 0)
}
