import { db, type SettlementRecord } from "@/lib/db"

export async function markSettlementPaid(input: {
  groupId: string
  fromUserId: string
  toUserId: string
  amountPaise: number
  note?: string
}): Promise<SettlementRecord> {
  const record: SettlementRecord = {
    id: crypto.randomUUID(),
    groupId: input.groupId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    amountPaise: input.amountPaise,
    status: "paid",
    paidAt: new Date().toISOString(),
    note: input.note,
    createdAt: new Date().toISOString(),
  }
  await db.settlements.add(record)
  return record
}

export async function getSettlementHistory(groupId: string): Promise<SettlementRecord[]> {
  const records = await db.settlements.where("groupId").equals(groupId).toArray()
  return records.sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt))
}

export async function getPaidSettlements(groupId: string): Promise<SettlementRecord[]> {
  const records = await getSettlementHistory(groupId)
  return records.filter((r) => r.status === "paid")
}
