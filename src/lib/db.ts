import Dexie, { type EntityTable } from "dexie"

export const SCHEMA_VERSION = 1

export interface AuthUser {
  userId: string
  deviceId: string
  displayName: string
}

export type CategoryScope = "global" | "group" | "private"

export interface Category {
  id: string
  name: string
  icon?: string
  color?: string
  scope: CategoryScope
  groupId?: string
  ownerUserId?: string
  isArchived: boolean
  createdAt: string
}

export interface PersonalExpense {
  id: string
  ownerUserId: string
  title: string
  amountPaise: number
  categoryId: string
  date: string
  notes?: string
  budgetPaise?: number
  createdAt: string
  updatedAt: string
}

export interface Group {
  id: string
  name: string
  description?: string
  budgetPaise?: number
  createdByUserId: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  displayName: string
  isActive: boolean
  joinedAt: string
}

export type SplitMethod = "equal_all" | "equal_selected" | "manual" | "percentage"

export type SplitData =
  | { method: "equal_all" }
  | { method: "equal_selected"; memberIds: string[] }
  | { method: "manual"; shares: Record<string, number> }
  | { method: "percentage"; shares: Record<string, number> }

export interface GroupExpense {
  id: string
  groupId: string
  title: string
  amountPaise: number
  categoryId: string
  date: string
  notes?: string
  paidByUserId: string
  splitMethod: SplitMethod
  splitData: SplitData
  createdAt: string
  updatedAt: string
}

export type SettlementStatus = "pending" | "paid"

export interface SettlementRecord {
  id: string
  groupId: string
  fromUserId: string
  toUserId: string
  amountPaise: number
  status: SettlementStatus
  paidAt?: string
  note?: string
  createdAt: string
}

export interface AppMeta {
  id: "meta"
  schemaVersion: number
  lastExportAt?: string
}

export interface SimplifiedDebt {
  fromUserId: string
  toUserId: string
  amountPaise: number
}

class AppDatabase extends Dexie {
  categories!: EntityTable<Category, "id">
  personalExpenses!: EntityTable<PersonalExpense, "id">
  groups!: EntityTable<Group, "id">
  groupMembers!: EntityTable<GroupMember, "id">
  groupExpenses!: EntityTable<GroupExpense, "id">
  settlements!: EntityTable<SettlementRecord, "id">
  appMeta!: EntityTable<AppMeta, "id">

  constructor() {
    super("splitxl_db")

    this.version(1).stores({
      categories: "id, scope, groupId, ownerUserId, isArchived",
      personalExpenses: "id, ownerUserId, categoryId, date, [ownerUserId+date]",
      groups: "id, createdByUserId, isArchived",
      groupMembers: "id, groupId, userId, [groupId+userId]",
      groupExpenses: "id, groupId, paidByUserId, categoryId, date, [groupId+date]",
      settlements: "id, groupId, fromUserId, toUserId, status",
      appMeta: "id",
    })
  }
}

export const db = new AppDatabase()
