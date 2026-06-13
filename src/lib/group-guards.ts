import { db, type Group, type GroupStatus } from "@/lib/db"

export class GroupMutationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GroupMutationError"
  }
}

export function isGroupReadOnly(group: Group): boolean {
  return group.status === "settled" || group.status === "archived"
}

export function isGroupLocked(group: Group): boolean {
  return group.status === "settlement_in_progress" || group.status === "settled"
}

export async function getGroupOrThrow(groupId: string): Promise<Group> {
  const group = await db.groups.get(groupId)
  if (!group) throw new GroupMutationError("Group not found.")
  return group
}

export async function assertGroupAllowsExpenseMutations(groupId: string): Promise<Group> {
  const group = await getGroupOrThrow(groupId)
  if (isGroupLocked(group)) {
    throw new GroupMutationError("Group is locked during settlement. Expenses cannot be modified.")
  }
  if (group.status === "archived") {
    throw new GroupMutationError("Archived groups are read-only.")
  }
  return group
}

export async function assertGroupAllowsMemberMutations(groupId: string): Promise<Group> {
  const group = await getGroupOrThrow(groupId)
  if (isGroupLocked(group)) {
    throw new GroupMutationError("Group is locked during settlement. Members cannot be modified.")
  }
  if (group.status === "archived") {
    throw new GroupMutationError("Archived groups are read-only.")
  }
  return group
}

export async function assertGroupAllowsGroupMutations(groupId: string): Promise<Group> {
  const group = await getGroupOrThrow(groupId)
  if (isGroupLocked(group)) {
    throw new GroupMutationError("Group is locked during settlement and cannot be modified.")
  }
  return group
}

export function statusLabel(status: GroupStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "settlement_in_progress":
      return "Settlement In Progress"
    case "settled":
      return "Settled"
    case "archived":
      return "Archived"
  }
}
