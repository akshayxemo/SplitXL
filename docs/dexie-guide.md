# Dexie.js Guide for SplitXL

## Table of Contents
- [Core Concepts](#core-concepts)
- [Abstraction Layer — Why and How](#abstraction-layer--why-and-how)
- [CRUD Examples](#crud-examples)
- [Querying](#querying)
- [Reactive UI with useLiveQuery](#reactive-ui-with-uselivequery)
- [Relationships](#relationships)
- [Schema Versioning & Migrations](#schema-versioning--migrations)
- [Best Practices](#best-practices)
- [What NOT to Do](#what-not-to-do)
- [Performance Tips](#performance-tips)

---

## Indexed vs Non-Indexed Fields

Whatever you list in `.stores()` is indexed. Everything else in the TypeScript interface is just stored.

```ts
this.version(1).stores({
  expenses: "id, groupId, paidByUserId, date, category",
})
```

```ts
export interface Expense {
  id: string           // ✅ indexed — listed in .stores()
  groupId: string      // ✅ indexed
  paidByUserId: string // ✅ indexed
  amount: number       // ❌ not indexed — stored but can't use .where("amount")
  category: string     // ✅ indexed
  description: string  // ❌ not indexed
  date: string         // ✅ indexed
  createdAt: string    // ❌ not indexed
}
```

The `.stores()` string is purely about indexes — it has nothing to do with what gets stored. Dexie stores the entire object regardless. The string just tells IndexedDB which fields to build a lookup index for.

- Fields you'll use in `.where()`, `.sortBy()`, or `.between()` → put in `.stores()`
- Fields you only read/display → leave them out, they're stored automatically

If you call `.where("amount")` on a non-indexed field, Dexie throws a runtime error. Either add it to `.stores()` in a new version, or use `.filter()` with the tradeoff that it's a full table scan.

---

## Core Concepts

Dexie wraps IndexedDB. IndexedDB is:
- Async and non-blocking
- Stored per origin (domain)
- Persistent across sessions
- Limited to the fields you declare in `.stores()` for querying — all other fields are stored but not indexed

Only indexed fields can be used in `.where()` clauses. Non-indexed fields can still be filtered with `.filter()` but that loads everything into memory first.

---

## Abstraction Layer — Why and How

**Do not call `db` directly from components or hooks.**

Instead, create a service file per module. This keeps your components clean, makes logic testable, and means if you ever swap Dexie for something else, you only change the service.

```
src/modules/expenses/services/expense.service.ts
src/modules/groups/services/group.service.ts
src/modules/members/services/member.service.ts
```

Each service file imports `db` and exports plain async functions.

```ts
// src/modules/expenses/services/expense.service.ts
import { db, type Expense } from "@/lib/db"

export async function addExpense(data: Omit<Expense, "id" | "createdAt">): Promise<Expense> {
  const expense: Expense = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  await db.expenses.add(expense)
  return expense
}

export async function getExpensesByGroup(groupId: string): Promise<Expense[]> {
  return db.expenses.where("groupId").equals(groupId).sortBy("date")
}

export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.delete(id)
}

export async function updateExpense(id: string, changes: Partial<Expense>): Promise<void> {
  await db.expenses.update(id, changes)
}
```

Then your hook calls the service, never `db` directly:

```ts
// src/modules/expenses/hooks/useAddExpense.ts
import { useState } from "react"
import { addExpense } from "../services/expense.service"
import type { Expense } from "@/lib/db"

export function useAddExpense() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(data: Omit<Expense, "id" | "createdAt">) {
    setLoading(true)
    setError(null)
    try {
      return await addExpense(data)
    } catch (e) {
      setError("Failed to save expense.")
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}
```

---

## CRUD Examples

### Add

```ts
await db.expenses.add({
  id: crypto.randomUUID(),
  groupId: "group-123",
  paidByUserId: "user-abc",
  amount: 42.5,
  category: "food",
  description: "Pizza",
  date: "2025-05-26",
  createdAt: new Date().toISOString(),
})
```

### Read by primary key

```ts
const expense = await db.expenses.get("expense-id-here")
```

### Update

```ts
await db.expenses.update("expense-id-here", { amount: 50, description: "Updated" })
```

### Delete

```ts
await db.expenses.delete("expense-id-here")
```

### Bulk add

```ts
await db.expenses.bulkAdd([expense1, expense2, expense3])
```

---

## Querying

### By indexed field

```ts
// All expenses in a group
const expenses = await db.expenses
  .where("groupId")
  .equals("group-123")
  .toArray()
```

### Sorted

```ts
const expenses = await db.expenses
  .where("groupId")
  .equals("group-123")
  .sortBy("date") // must be an indexed field
```

### Date range

```ts
const expenses = await db.expenses
  .where("date")
  .between("2025-01-01", "2025-01-31", true, true)
  .toArray()
```

### Filter on non-indexed field (use sparingly — loads all records first)

```ts
const foodExpenses = await db.expenses
  .where("groupId").equals("group-123")
  .filter(e => e.category === "food")
  .toArray()
```

Better: index `category` if you filter by it often (already done in db.ts).

### Count

```ts
const total = await db.expenses.where("groupId").equals("group-123").count()
```

### Sum (manual reduce)

```ts
const expenses = await db.expenses.where("groupId").equals("group-123").toArray()
const total = expenses.reduce((sum, e) => sum + e.amount, 0)
```

---

## Reactive UI with useLiveQuery

`useLiveQuery` re-runs the query and re-renders the component whenever the underlying data changes. No manual state sync needed.

```ts
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"

function ExpenseList({ groupId }: { groupId: string }) {
  const expenses = useLiveQuery(
    () => db.expenses.where("groupId").equals(groupId).sortBy("date"),
    [groupId] // re-runs when groupId changes
  )

  if (!expenses) return <p>Loading...</p>

  return (
    <ul>
      {expenses.map(e => (
        <li key={e.id}>{e.description} — ${e.amount}</li>
      ))}
    </ul>
  )
}
```

`useLiveQuery` returns `undefined` on the first render (before the async query resolves), so always handle the loading state.

---

## Relationships

Dexie is not a relational DB — there are no joins. You fetch related data manually or in parallel.

### Fetch a group with its members and expenses

```ts
async function getGroupWithDetails(groupId: string) {
  const [group, members, expenses] = await Promise.all([
    db.groups.get(groupId),
    db.members.where("groupId").equals(groupId).toArray(),
    db.expenses.where("groupId").equals(groupId).toArray(),
  ])
  return { group, members, expenses }
}
```

### Reactive version

```ts
const data = useLiveQuery(async () => {
  const [group, members, expenses] = await Promise.all([
    db.groups.get(groupId),
    db.members.where("groupId").equals(groupId).toArray(),
    db.expenses.where("groupId").equals(groupId).toArray(),
  ])
  return { group, members, expenses }
}, [groupId])
```

---

## Schema Versioning & Migrations

Never edit an existing version. Always add a new one.

```ts
this.version(1).stores({
  expenses: "id, groupId, paidByUserId, date, category",
  groups:   "id, createdByUserId",
  members:  "id, groupId, userId",
})

// Adding a new index or table in the future:
this.version(2).stores({
  expenses: "id, groupId, paidByUserId, date, category, [groupId+date]", // compound index added
  groups:   "id, createdByUserId",
  members:  "id, groupId, userId",
  // new table:
  settlements: "id, groupId, fromUserId, toUserId",
})
```

Dexie runs migrations automatically when the user's browser has an older version of the DB.

### Compound indexes

Useful when you always query by two fields together:

```ts
expenses: "id, groupId, date, [groupId+date]"
```

```ts
// now this is fast:
await db.expenses.where("[groupId+date]").between(
  ["group-123", "2025-01-01"],
  ["group-123", "2025-12-31"]
).toArray()
```

---

## Best Practices

- **One `db.ts` file** — single database instance shared across the whole app
- **Service layer per module** — never call `db` from components or hooks directly
- **Always use `crypto.randomUUID()`** for IDs — consistent, collision-free
- **Store dates as ISO strings** (`new Date().toISOString()`) — sortable and indexable
- **Index fields you filter or sort by** — unindexed `.filter()` is a full table scan
- **Use `Promise.all`** for parallel reads — much faster than sequential awaits
- **Handle `undefined` from `useLiveQuery`** — it's always undefined on first render
- **Wrap writes in transactions** when multiple tables must stay in sync

```ts
// Atomic: either both succeed or both fail
await db.transaction("rw", db.groups, db.members, async () => {
  const groupId = crypto.randomUUID()
  await db.groups.add({ id: groupId, name, createdByUserId, createdAt: new Date().toISOString() })
  await db.members.add({ id: crypto.randomUUID(), groupId, userId, displayName, joinedAt: new Date().toISOString() })
})
```

---

## What NOT to Do

```ts
// ❌ Don't call db directly in a component
function MyComponent() {
  const handleClick = async () => {
    await db.expenses.add(...)  // wrong — belongs in a service
  }
}

// ❌ Don't filter on non-indexed fields when the table is large
await db.expenses.filter(e => e.description.includes("pizza")).toArray()
// This loads every record into memory. Add an index or restructure the query.

// ❌ Don't store amounts as strings
{ amount: "42.50" }  // sorting and summing will break

// ❌ Don't mutate useLiveQuery results directly
expenses[0].amount = 100  // won't persist, won't trigger re-render

// ❌ Don't add new fields to an existing version()
// Edit version(1) after users have it installed = data corruption
this.version(1).stores({ expenses: "id, groupId, newField" }) // wrong

// ❌ Don't use .toArray() then filter in JS when an index exists
const all = await db.expenses.toArray()
const filtered = all.filter(e => e.groupId === id) // wasteful — use .where() instead
```

---

## Performance Tips

- Prefer `.where().equals()` over `.filter()` — indexed lookups are O(log n)
- Use compound indexes `[groupId+date]` for multi-field queries you run often
- Use `bulkAdd` / `bulkDelete` for batch operations instead of looping
- Paginate large lists with `.offset(n).limit(n).toArray()`
- Keep `useLiveQuery` dependencies tight — broad queries re-run more often

```ts
// Pagination example
const page = 0
const pageSize = 20

const expenses = await db.expenses
  .where("groupId").equals(groupId)
  .offset(page * pageSize)
  .limit(pageSize)
  .sortBy("date")
```
