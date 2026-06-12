import { db, type PersonalExpense } from "@/lib/db"
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns"

export type ExpenseFilters = {
  categoryId?: string
  month?: string
  year?: string
  startDate?: string
  endDate?: string
}

export async function addPersonalExpense(
  input: Omit<PersonalExpense, "id" | "createdAt" | "updatedAt">
): Promise<PersonalExpense> {
  const now = new Date().toISOString()
  const expense: PersonalExpense = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  await db.personalExpenses.add(expense)
  return expense
}

export async function updatePersonalExpense(
  id: string,
  changes: Partial<Omit<PersonalExpense, "id" | "ownerUserId" | "createdAt">>
): Promise<void> {
  await db.personalExpenses.update(id, { ...changes, updatedAt: new Date().toISOString() })
}

export async function deletePersonalExpense(id: string): Promise<void> {
  await db.personalExpenses.delete(id)
}

export async function getPersonalExpenses(
  ownerUserId: string,
  filters: ExpenseFilters = {}
): Promise<PersonalExpense[]> {
  let expenses = await db.personalExpenses
    .where("ownerUserId")
    .equals(ownerUserId)
    .toArray()

  if (filters.categoryId) {
    expenses = expenses.filter((e) => e.categoryId === filters.categoryId)
  }

  if (filters.month) {
    const [y, m] = filters.month.split("-").map(Number)
    const start = format(new Date(y, m - 1, 1), "yyyy-MM-dd")
    const end = format(endOfMonth(new Date(y, m - 1, 1)), "yyyy-MM-dd")
    expenses = expenses.filter((e) => e.date >= start && e.date <= end)
  }

  if (filters.year) {
    expenses = expenses.filter((e) => e.date.startsWith(`${filters.year}-`))
  }

  if (filters.startDate) {
    expenses = expenses.filter((e) => e.date >= filters.startDate!)
  }

  if (filters.endDate) {
    expenses = expenses.filter((e) => e.date <= filters.endDate!)
  }

  return expenses.sort((a, b) => b.date.localeCompare(a.date))
}

export function sumExpenses(expenses: PersonalExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountPaise, 0)
}

export function groupByCategory(
  expenses: PersonalExpense[]
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const e of expenses) {
    map[e.categoryId] = (map[e.categoryId] ?? 0) + e.amountPaise
  }
  return map
}

export function groupByMonth(expenses: PersonalExpense[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const e of expenses) {
    const month = e.date.slice(0, 7)
    map[month] = (map[month] ?? 0) + e.amountPaise
  }
  return map
}

export function getMonthRange(monthStr: string): { start: string; end: string } {
  const [y, m] = monthStr.split("-").map(Number)
  const date = new Date(y, m - 1, 1)
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  }
}

export function parseExpenseDate(date: string): Date {
  return parseISO(date)
}
