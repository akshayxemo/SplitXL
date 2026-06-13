import { describe, it, expect, beforeEach } from "vitest"
import { db, type GroupMember } from "@/lib/db"
import { addFriend, updateFriend } from "@/features/friends/friends.db"

const OWNER_ACCOUNT_ID = "test-account-001"

function randomId() {
  return crypto.randomUUID()
}

async function seedFriend(overrides?: { email?: string; phone?: string }) {
  return addFriend({
    ownerAccountId: OWNER_ACCOUNT_ID,
    displayName: `Friend-${randomId()}`,
    email: overrides?.email ?? "test@example.com",
    phone: overrides?.phone,
  })
}

async function seedGroupMember(overrides: Partial<GroupMember> & { linkedFriendId: string }): Promise<GroupMember> {
  const now = new Date().toISOString()
  const member: GroupMember = {
    id: randomId(),
    groupId: overrides.groupId ?? randomId(),
    displayName: overrides.displayName ?? `Member-${randomId()}`,
    email: overrides.email ?? "member@example.com",
    phone: overrides.phone,
    linkedFriendId: overrides.linkedFriendId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.groupMembers.add(member)
  return member
}

describe("friends", () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  // Feature: splitxl-incremental-changes, Property 6: Friend contact validation
  // Validates: Requirements 6.3, 6.4
  describe("Property 6: Friend contact validation — updateFriend rejects when both email and phone are empty", () => {
    const ITERATIONS = 50

    it("rejects updateFriend when both email and phone are cleared", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const friend = await seedFriend()

        await expect(
          updateFriend(friend.id, { email: "", phone: "" })
        ).rejects.toThrow()

        // Friend record must remain unchanged
        const unchanged = await db.friends.get(friend.id)
        expect(unchanged?.email).toBe("test@example.com")
      }
    })

    it("rejects updateFriend when both email and phone are whitespace-only", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const friend = await seedFriend()

        await expect(
          updateFriend(friend.id, { email: "   ", phone: "  " })
        ).rejects.toThrow()

        const unchanged = await db.friends.get(friend.id)
        expect(unchanged?.email).toBe("test@example.com")
      }
    })

    it("accepts updateFriend when at least email is provided", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const friend = await seedFriend()
        const newEmail = `user${i}@example.com`

        await expect(
          updateFriend(friend.id, { email: newEmail, phone: "" })
        ).resolves.not.toThrow()

        const updated = await db.friends.get(friend.id)
        expect(updated?.email).toBe(newEmail)
      }
    })

    it("accepts updateFriend when at least phone is provided", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const friend = await seedFriend()
        const newPhone = `+1555${String(i).padStart(7, "0")}`

        await expect(
          updateFriend(friend.id, { email: "", phone: newPhone })
        ).resolves.not.toThrow()

        const updated = await db.friends.get(friend.id)
        expect(updated?.phone).toBe(newPhone)
      }
    })
  })

  // Feature: splitxl-incremental-changes, Property 7: Friend update propagates to all linked members
  // Validates: Requirements 7.3
  describe("Property 7: Friend update propagates to all linked members", () => {
    const ITERATIONS = 50

    it("propagates displayName, email, and phone to all linked members", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const friend = await seedFriend()
        const memberCount = (i % 4) + 1 // 1 to 4 linked members per iteration

        const members = await Promise.all(
          Array.from({ length: memberCount }, () =>
            seedGroupMember({ linkedFriendId: friend.id })
          )
        )

        const newName = `Updated-${randomId()}`
        const newEmail = `updated-${i}@example.com`
        const newPhone = `+1800${String(i).padStart(7, "0")}`

        await updateFriend(friend.id, {
          displayName: newName,
          email: newEmail,
          phone: newPhone,
        })

        for (const member of members) {
          const updated = await db.groupMembers.get(member.id)
          expect(updated?.displayName, `member ${member.id} displayName`).toBe(newName)
          expect(updated?.email, `member ${member.id} email`).toBe(newEmail)
          expect(updated?.phone, `member ${member.id} phone`).toBe(newPhone)
        }
      }
    })

    it("does not affect members linked to a different friend", async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const friend = await seedFriend()
        const otherFriend = await seedFriend({ email: `other-${i}@example.com` })

        const unrelatedMember = await seedGroupMember({ linkedFriendId: otherFriend.id })
        const originalUnrelatedName = unrelatedMember.displayName

        await updateFriend(friend.id, {
          displayName: `Updated-${randomId()}`,
          email: `new-${i}@example.com`,
        })

        const untouched = await db.groupMembers.get(unrelatedMember.id)
        expect(untouched?.displayName).toBe(originalUnrelatedName)
      }
    })
  })
})
