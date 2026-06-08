import Dexie, { type EntityTable } from "dexie"

// --- Table types ---

export interface Expense {
  id: string
  groupId: string
  paidByUserId: string
  amount: number
  category: string
  description: string
  date: string       // ISO string
  createdAt: string
}

export interface Group {
  id: string
  name: string
  createdByUserId: string
  createdAt: string
}

export interface Member {
  id: string
  groupId: string
  userId: string
  displayName: string
  joinedAt: string
}

// --- Database ---

class AppDatabase extends Dexie {
  expenses!: EntityTable<Expense, "id">
  groups!: EntityTable<Group, "id">
  members!: EntityTable<Member, "id">

  constructor() {
    super("splitxl_db")

    this.version(1).stores({
      expenses: "id, groupId, paidByUserId, date, category",
      groups:   "id, createdByUserId",
      members:  "id, groupId, userId",
    })
  }
}

export const db = new AppDatabase()
