# Zustand Guide for SplitXL

## Table of Contents
- [What is Zustand](#what-is-zustand)
- [Store Structure in this Project](#store-structure-in-this-project)
- [Creating a Store](#creating-a-store)
- [Reading State in Components](#reading-state-in-components)
- [Updating State](#updating-state)
- [Persisted Stores](#persisted-stores)
- [Derived / Computed Values](#derived--computed-values)
- [Async Actions](#async-actions)
- [Using Outside React](#using-outside-react)
- [Combining with Dexie](#combining-with-dexie)
- [Best Practices](#best-practices)
- [What NOT to Do](#what-not-to-do)

---

## What is Zustand

Zustand is a minimal global state manager. No providers, no boilerplate. A store is just a hook.

Use it for:
- State that multiple unrelated components need (auth user, active group, theme)
- State that needs to persist across navigation
- Replacing prop drilling

Do NOT use it for:
- Local UI state (open/close, hover, form input) — use `useState`
- Server/DB data — use Dexie + `useLiveQuery` for that

---

## Store Structure in this Project

```
src/
├── store/
│   └── ui.store.ts          — app-wide UI state (theme, sidebar, active group)
└── modules/
    └── auth/
        └── store/
            └── auth.store.ts  — auth user state (persisted to localStorage)
```

Module-specific stores live inside the module. Truly global cross-module stores live in `src/store/`.

---

## Creating a Store

```ts
import { create } from "zustand"

interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

export const useCounterStore = create<CounterState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}))
```

Rules:
- Always define a TypeScript interface for the store
- Put state and actions together in the same store
- Name the hook `use[Name]Store`

---

## Reading State in Components

Always select only what you need. Do NOT destructure the whole store.

```ts
// ✅ correct — component only re-renders when `user` changes
const user = useAuthStore((state) => state.user)

// ✅ correct — selecting multiple values
const { theme, sidebarOpen } = useUIStore((state) => ({
  theme: state.theme,
  sidebarOpen: state.sidebarOpen,
}))

// ❌ wrong — subscribes to every change in the store
const store = useAuthStore()
```

---

## Updating State

Call actions directly — they are part of the store.

```ts
const setUser = useAuthStore((state) => state.setUser)
const logout = useAuthStore((state) => state.logout)

// call them
setUser({ userId: "...", deviceId: "...", displayName: "John" })
logout()
```

For state that depends on previous state, use the updater form:

```ts
set((state) => ({ count: state.count + 1 }))
```

For state that does not depend on previous state, pass the object directly:

```ts
set({ theme: "dark" })
```

---

## Persisted Stores

Use the `persist` middleware to sync state to localStorage automatically.

```ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: "auth_user",           // localStorage key
      partialize: (state) => ({ user: state.user }), // only persist these fields, not actions
    }
  )
)
```

`partialize` is important — without it, Zustand tries to serialize action functions into localStorage, which is wasteful and can cause issues.

---

## Derived / Computed Values

Compute derived values inside the selector, not the store.

```ts
// ✅ compute in selector
const isLoggedIn = useAuthStore((state) => state.user !== null)
const displayName = useAuthStore((state) => state.user?.displayName ?? "Guest")

// ❌ don't store derived values in the store itself
// (they'd need to stay in sync manually)
```

---

## Async Actions

Zustand actions can be async. Call `set` after the async operation completes.

```ts
interface GroupState {
  activeGroup: Group | null
  loading: boolean
  fetchGroup: (id: string) => Promise<void>
}

export const useGroupStore = create<GroupState>()((set) => ({
  activeGroup: null,
  loading: false,

  fetchGroup: async (id) => {
    set({ loading: true })
    try {
      const group = await db.groups.get(id)
      set({ activeGroup: group ?? null })
    } finally {
      set({ loading: false })
    }
  },
}))
```

---

## Using Outside React

You can read and write store state outside of components — useful in service files or event handlers.

```ts
import { useAuthStore } from "@/src/modules/auth/store/auth.store"

// read current state
const user = useAuthStore.getState().user

// update state
useAuthStore.getState().logout()

// subscribe to changes
const unsub = useAuthStore.subscribe(
  (state) => state.user,
  (user) => console.log("user changed", user)
)
unsub() // cleanup
```

---

## Combining with Dexie

The pattern for a typical feature:
- Dexie owns the data (source of truth)
- Zustand owns transient UI state (which group is active, loading flags, sidebar state)
- `useLiveQuery` keeps the UI reactive to DB changes

```ts
// In a component:
const activeGroupId = useUIStore((state) => state.activeGroupId)

// Reactive DB query — re-runs when activeGroupId changes or DB data changes
const expenses = useLiveQuery(
  () => activeGroupId
    ? db.expenses.where("groupId").equals(activeGroupId).sortBy("date")
    : [],
  [activeGroupId]
)
```

Don't duplicate DB data in Zustand. If it lives in Dexie, read it with `useLiveQuery`.

---

## Best Practices

- One store per concern — auth, UI, not one giant store
- Module stores live inside the module folder, global stores in `src/store/`
- Always use selectors — `useStore((state) => state.x)` not `useStore()`
- Use `partialize` with `persist` to avoid serializing functions
- Keep actions in the store, not scattered in components or hooks
- Use `getState()` for one-off reads outside React (service files, utilities)

---

## What NOT to Do

```ts
// ❌ subscribing to the whole store — re-renders on every state change
const everything = useAuthStore()

// ❌ storing data that's already in Dexie
const useExpenseStore = create()((set) => ({
  expenses: [],  // source of truth is Dexie, not here
}))

// ❌ calling hooks inside actions
const useStore = create()((set) => ({
  doSomething: () => {
    const x = useSomeOtherHook() // ❌ hooks only work inside React components/hooks
  }
}))

// ❌ persisting without partialize — serializes functions into localStorage
persist((set) => ({ ... }), { name: "store" }) // missing partialize

// ❌ local UI state in Zustand — use useState instead
const useButtonStore = create()((set) => ({
  isHovered: false, // this is local UI state, not global
}))
```
