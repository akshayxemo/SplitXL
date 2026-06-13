import { db, type Friend } from "@/lib/db"
import { validateContact } from "@/features/accounts/accounts.db"

export async function getFriends(ownerAccountId: string, includeArchived = false): Promise<Friend[]> {
  const friends = await db.friends.where("ownerAccountId").equals(ownerAccountId).toArray()
  return includeArchived ? friends : friends.filter((f) => !f.isArchived)
}

export async function getFriend(id: string): Promise<Friend | undefined> {
  return db.friends.get(id)
}

export async function addFriend(input: {
  ownerAccountId: string
  displayName: string
  email?: string
  phone?: string
  notes?: string
}): Promise<Friend> {
  const error = validateContact(input.email, input.phone)
  if (error) throw new Error(error)
  const now = new Date().toISOString()
  const friend: Friend = {
    id: crypto.randomUUID(),
    ownerAccountId: input.ownerAccountId,
    displayName: input.displayName.trim(),
    email: input.email?.trim(),
    phone: input.phone?.trim(),
    notes: input.notes?.trim(),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.friends.add(friend)
  return friend
}

export async function updateFriend(
  id: string,
  changes: Partial<Pick<Friend, "displayName" | "email" | "phone" | "notes">>
): Promise<void> {
  const existing = await db.friends.get(id)
  if (!existing) throw new Error("Friend not found.")
  const email = changes.email !== undefined ? changes.email : existing.email
  const phone = changes.phone !== undefined ? changes.phone : existing.phone
  const error = validateContact(email, phone)
  if (error) throw new Error(error)
  await db.friends.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function archiveFriend(id: string): Promise<void> {
  await db.friends.update(id, { isArchived: true, updatedAt: new Date().toISOString() })
}

export async function deleteFriend(id: string): Promise<void> {
  const members = await db.groupMembers.filter((m) => m.linkedFriendId === id).toArray()
  await db.transaction("rw", db.friends, db.groupMembers, async () => {
    for (const member of members) {
      await db.groupMembers.update(member.id, { linkedFriendId: undefined })
    }
    await db.friends.delete(id)
  })
}

export async function restoreFriend(id: string): Promise<void> {
  await db.friends.update(id, { isArchived: false, updatedAt: new Date().toISOString() })
}
