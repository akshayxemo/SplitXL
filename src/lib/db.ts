import Dexie, { type EntityTable } from "dexie"

export const SCHEMA_VERSION = 5
export const EXPORT_VERSION = 2

export interface AuthUser {
  accountId: string
  deviceId: string
  displayName: string
  /** @deprecated use accountId */
  userId?: string
}

export interface Account {
  id: string
  displayName: string
  email?: string
  phone?: string
  createdAt: string
  updatedAt: string
}

export interface Friend {
  id: string
  ownerAccountId: string
  displayName: string
  email?: string
  phone?: string
  avatar?: string
  notes?: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export type CategoryScope = "global" | "group" | "personal"

export interface Category {
  id: string
  name: string
  emoji?: string
  icon?: string
  color?: string
  scope: CategoryScope
  groupId?: string
  ownerAccountId?: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface PersonalExpense {
  id: string
  ownerAccountId: string
  title: string
  amountPaise: number
  categoryId: string
  date: string
  transactionDateTime: string
  notes?: string
  budgetPaise?: number
  createdAt: string
  updatedAt: string
}

export type GroupStatus = "active" | "settlement_in_progress" | "settled" | "archived"

export interface Group {
  id: string
  name: string
  description?: string
  budgetPaise?: number
  createdByAccountId: string
  status: GroupStatus
  settlementStartedAt?: string
  settledAt?: string
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  id: string
  groupId: string
  displayName: string
  email?: string
  phone?: string
  linkedFriendId?: string
  linkedAccountId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SplitMethod = "equal_all" | "equal_selected" | "manual" | "percentage"

export type SplitData =
  | { method: "equal_all" }
  | { method: "equal_selected"; memberIds: string[] }
  | { method: "manual"; shares: Record<string, number> }
  | { method: "percentage"; shares: Record<string, number> }

export type TransactionType = "expense" | "refund" | "settlement_payment"

export interface Transaction {
  id: string
  groupId: string
  type: TransactionType
  title: string
  amountPaise: number
  categoryId?: string
  paidByMemberId: string
  splitMethod?: SplitMethod
  splitData?: SplitData
  refundOfTransactionId?: string
  settlementFromMemberId?: string
  settlementToMemberId?: string
  notes?: string
  transactionDateTime: string
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: string
  theme?: "light" | "dark" | "system"
  updatedAt: string
}

export interface AppMeta {
  id: "meta"
  schemaVersion: number
  lastExportAt?: string
}

export interface SimplifiedDebt {
  fromMemberId: string
  toMemberId: string
  amountPaise: number
}

/** @deprecated v1 legacy — cleared after v3 migration */
export interface LegacyGroupExpense {
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

/** @deprecated v1 legacy — cleared after v3 migration */
export interface LegacySettlementRecord {
  id: string
  groupId: string
  fromUserId: string
  toUserId: string
  amountPaise: number
  status: "pending" | "paid"
  paidAt?: string
  note?: string
  createdAt: string
}

class AppDatabase extends Dexie {
  accounts!: EntityTable<Account, "id">
  friends!: EntityTable<Friend, "id">
  categories!: EntityTable<Category, "id">
  personalExpenses!: EntityTable<PersonalExpense, "id">
  groups!: EntityTable<Group, "id">
  groupMembers!: EntityTable<GroupMember, "id">
  transactions!: EntityTable<Transaction, "id">
  settings!: EntityTable<AppSettings, "id">
  groupExpenses!: EntityTable<LegacyGroupExpense, "id">
  settlements!: EntityTable<LegacySettlementRecord, "id">
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

    this.version(2)
      .stores({
        accounts: "id, email, phone, createdAt",
        friends: "id, ownerAccountId, email, phone, isArchived, [ownerAccountId+isArchived]",
        categories: "id, scope, groupId, ownerUserId, isArchived",
        personalExpenses: "id, ownerUserId, categoryId, date, [ownerUserId+date]",
        groups: "id, createdByUserId, isArchived",
        groupMembers: "id, groupId, linkedAccountId, linkedFriendId, [groupId+linkedAccountId]",
        groupExpenses: "id, groupId, paidByUserId, categoryId, date, [groupId+date]",
        settlements: "id, groupId, fromUserId, toUserId, status",
        appMeta: "id",
      })
      .upgrade(async (tx) => {
        const { migrateV2 } = await import("@/lib/migrations/v2-members-accounts")
        await migrateV2(tx)
      })

    this.version(3)
      .stores({
        accounts: "id, email, phone, createdAt",
        friends: "id, ownerAccountId, email, phone, isArchived, [ownerAccountId+isArchived]",
        categories: "id, scope, groupId, ownerUserId, isArchived",
        personalExpenses: "id, ownerUserId, categoryId, date, [ownerUserId+date]",
        groups: "id, createdByUserId, isArchived",
        groupMembers: "id, groupId, linkedAccountId, linkedFriendId, [groupId+linkedAccountId]",
        transactions:
          "id, groupId, type, paidByMemberId, categoryId, transactionDateTime, [groupId+type], [groupId+transactionDateTime]",
        groupExpenses: "id, groupId, paidByUserId, categoryId, date, [groupId+date]",
        settlements: "id, groupId, fromUserId, toUserId, status",
        appMeta: "id",
      })
      .upgrade(async (tx) => {
        const { migrateV3 } = await import("@/lib/migrations/v3-transactions")
        await migrateV3(tx)
      })

    this.version(4)
      .stores({
        accounts: "id, email, phone, createdAt",
        friends: "id, ownerAccountId, email, phone, isArchived, [ownerAccountId+isArchived]",
        categories: "id, scope, groupId, ownerAccountId, isArchived",
        personalExpenses: "id, ownerAccountId, categoryId, date, [ownerAccountId+date]",
        groups: "id, createdByAccountId, status",
        groupMembers: "id, groupId, linkedAccountId, linkedFriendId, [groupId+linkedAccountId]",
        transactions:
          "id, groupId, type, paidByMemberId, categoryId, transactionDateTime, [groupId+type], [groupId+transactionDateTime]",
        groupExpenses: "id",
        settlements: "id",
        appMeta: "id",
      })
      .upgrade(async (tx) => {
        const { migrateV4 } = await import("@/lib/migrations/v4-lifecycle-categories")
        await migrateV4(tx)
      })

    this.version(5)
      .stores({
        accounts: "id, email, phone, createdAt",
        friends: "id, ownerAccountId, email, phone, isArchived, [ownerAccountId+isArchived]",
        categories: "id, scope, groupId, ownerAccountId, isArchived",
        personalExpenses:
          "id, ownerAccountId, categoryId, date, transactionDateTime, [ownerAccountId+date]",
        groups: "id, createdByAccountId, status",
        groupMembers: "id, groupId, linkedAccountId, linkedFriendId, [groupId+linkedAccountId]",
        transactions:
          "id, groupId, type, paidByMemberId, categoryId, transactionDateTime, [groupId+type], [groupId+transactionDateTime]",
        settings: "id",
        groupExpenses: "id",
        settlements: "id",
        appMeta: "id",
      })
      .upgrade(async (tx) => {
        const { migrateV5 } = await import("@/lib/migrations/v5-datetime-settings")
        await migrateV5(tx)
      })
  }
}

export const db = new AppDatabase()

export function getAccountId(user: AuthUser): string {
  return user.accountId ?? user.userId ?? ""
}
