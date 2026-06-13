# Implementation Plan: SplitXL Incremental Changes

## Overview

12 incremental improvements across auth, settings, categories, expenses, friends, groups, insights, and timeline. No schema migrations needed. Implementation order: quick wins first, then friend/member sync, then UI improvements, then login flow.

## Tasks

- [x] 1. Date & Time Field Consolidation (Change 4)
  - Remove the `<Input type="date">` field from `ExpensesPage.tsx`
  - Remove `form.date` from form state; derive date from `transactionDateTime` for filtering
  - Update `handleSubmit` to not pass `date` separately
  - Ensure `filters` continue working using `isoToDateString(transactionDateTime)` for comparisons
  - _Requirements: 4.1, 4.2_

  - [x] 1.1 Write example test for personal expense form — verify no standalone date input exists
    - **Validates: Requirements 4.1, 4.2**

- [x] 2. Remove Save Profile Button (Change 1)
  - Wrap profile inputs in `SettingsPage.tsx` in a `<form onSubmit={handleSaveProfile}>`
  - Replace the standalone `<Button onClick={handleSaveProfile}>Save Profile</Button>` with a submit button inside the form
  - Keep success and error message display
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.1 Write property test: for any valid profile input, saving persists all fields to db
    - **Property 1: Profile save persists all fields**
    - **Validates: Requirements 1.2**

- [x] 3. Category System Improvements (Change 3)
  - [x] 3.1 Update `db-migrate.ts` DEFAULT_CATEGORIES to the full 10-entry list
    - Add: 🏨 Hotel, 🎟️ Tickets, 💊 Medical, 🏠 Rent, 📚 Education, ✈️ Travel
    - Remove color field from seed data
    - _Requirements: 3.1_

  - [x] 3.2 Update `CategoriesPage.tsx` — remove color picker, allow editing system categories
    - Remove `<Input type="color">` from create and edit forms
    - Remove `color` state field
    - Allow the Edit button to show for ALL categories including `scope: "global"` 
    - Show informative text instead of delete button for system categories
    - Update edit form to include both emoji and name fields
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.3 Write property test: updateCategory accepts name and emoji for any scope
    - **Property 3: Category edit accepts name and emoji for all scopes**
    - **Validates: Requirements 3.3, 3.6**

  - [x] 3.4 Write property test: deleteCategory rejects global categories
    - **Property 4: System category deletion is rejected**
    - **Validates: Requirements 3.4**

- [x] 4. Category Display Consistency (Change 9)
  - In `ExpensesPage.tsx` filter dropdown, change `c.name` to `formatCategoryLabel(c)` (emoji+name)
  - Verify the expense list card uses `categoryMap` which should already include emoji via `formatCategoryLabel`
  - In `TransactionTimeline.tsx` collapsed view, ensure category emoji is always visible
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 4.1 Write property test: formatCategoryLabel always returns emoji+name
    - **Property 10: Category label always includes emoji and name**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

- [x] 5. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 6. Friend Management — Edit and View (Change 6)
  - Add edit button and inline edit form to each friend card in `FriendsPage.tsx`
  - Edit form fields: displayName, email, phone, notes
  - Validate: email OR phone required (reuse `validateContact`)
  - Add view detail panel showing: name, email, phone, notes, archived status, createdAt
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 6.1 Write property test: updateFriend rejects when both email and phone are empty
    - **Property 6: Friend contact validation**
    - **Validates: Requirements 6.3, 6.4**

- [x] 7. Friend and Member Synchronization (Change 7)
  - [x] 7.1 Update `updateFriend` in `friends.db.ts` to propagate changes to all linked group members
    - Wrap in `db.transaction("rw", db.friends, db.groupMembers, ...)`
    - After updating friend, find all members with `linkedFriendId = id` and update displayName, email, phone
    - _Requirements: 7.3_

  - [x] 7.2 Add `updateGroupMember` to `groups.db.ts` with bidirectional sync
    - If `linkedFriendId` is set: update the friend + update all sibling members (same linkedFriendId) in a transaction
    - If `linkedFriendId` is null: update only that member
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 7.3 Write property test: friend update propagates to all linked members
    - **Property 7: Friend update propagates to all linked members**
    - **Validates: Requirements 7.3**

  - [ ] 7.4 Write property test: linked member update propagates bidirectionally
    - **Property 8: Linked member update propagates bidirectionally**
    - **Validates: Requirements 7.1, 7.2**

  - [ ] 7.5 Write property test: standalone member update has no side effects
    - **Property 9: Standalone member update has no side effects**
    - **Validates: Requirements 7.4**

- [x] 8. Friend Selection UX (Change 8)
  - In `GroupDetailPage.tsx` "Select Friend" mode, replace plain select `<option>` with richer display
  - Each friend option shows: `{displayName} · {email ?? ""} · {phone ?? ""}` or a card-list UI
  - _Requirements: 8.1_

- [ ] 9. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 10. UX Consistency — Member Edit, View, and Confirmation (Change 12)
  - [x] 10.1 Add member view detail panel in `GroupDetailPage.tsx` members tab
    - Show: name, email, phone, linked friend (name or "Not linked"), createdAt
    - _Requirements: 12.2_

  - [x] 10.2 Add member edit form in `GroupDetailPage.tsx` members tab
    - Inline edit form with name, email, phone
    - On save: call `updateGroupMember()` (handles sync)
    - _Requirements: 12.3, 12.4_

  - [x] 10.3 Add confirmation modal to "Remove" member action in `GroupDetailPage.tsx`
    - Wrap `removeGroupMember` call with a `ConfirmationModal`
    - _Requirements: 12.5_

  - [x] 10.4 Ensure category delete for system categories shows informative message (not silent)
    - Add UI message: "System categories cannot be deleted"
    - _Requirements: 12.6_

- [x] 11. Timeline Detail Improvements (Change 11)
  - [x] 11.1 Update `TransactionTimeline.tsx` collapsed view
    - Ensure "Paid by {name}" is always visible inline in collapsed view
    - _Requirements: 11.1_

  - [x] 11.2 Add split breakdown to expanded view in `TransactionTimeline.tsx`
    - Import and call `computeShares(tx, members)` to get per-member amounts
    - Render a per-member breakdown table in expanded view
    - List participants (members with non-zero share, or all active for equal_all)
    - _Requirements: 11.2_

  - [ ] 11.3 Write property test: collapsed timeline card contains all required fields
    - **Property 13: Timeline collapsed view renders required fields**
    - **Validates: Requirements 11.1**

  - [ ] 11.4 Write property test: expanded timeline card contains all detail fields
    - **Property 14: Timeline expanded view renders all detail fields**
    - **Validates: Requirements 11.2**

- [-] 12. Insights Clarification and Labeling (Change 5)
  - [x] 12.1 Add `computeSettlementProgress` helper to `lib/settlement.ts`
    - Parameters: `transactions: Transaction[], members: GroupMember[]`
    - Returns: `{ totalDebt, settledAmount, remainingAmount, completionPct }`
    - _Requirements: 5.4_

  - [x] 12.2 Update group insights section in `InsightsPage.tsx`
    - Replace the combined "Member Contributions" single pie with four separate labeled metric cards per member: Amount Paid, Amount Consumed, Net Position, Expense Count
    - Replace the single "Settlement Progress" % with a breakdown card showing all four fields
    - Add chart titles with time period and metric descriptions
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 12.3 Write property test: settlement progress calculation is consistent
    - **Property 5: Settlement progress calculation is consistent**
    - **Validates: Requirements 5.4**

- [-] 13. Data Integrity (Change 10)
  - [x] 13.1 Add `validateDatabaseIntegrity()` call after `deleteAccountData()` completes
    - In `accounts.db.ts`, after the deletion transaction, run integrity check
    - Log any issues; surface message if invalid
    - _Requirements: 10.1_

  - [x] 13.2 Add post-delete integrity assertion after `deleteGroup()` and `deleteFriend()`
    - In `groups.db.ts` `deleteGroup`, add assertion that no groupId references remain
    - In `friends.db.ts` `deleteFriend`, add assertion that no linkedFriendId references remain
    - _Requirements: 10.3, 10.4_

  - [ ] 13.3 Write property test: account deletion leaves no orphaned records
    - **Property 2: Account deletion leaves no orphans**
    - **Validates: Requirements 2.8, 2.9, 2.10, 10.1**

  - [ ] 13.4 Write property test: group deletion cascades completely
    - **Property 11: Group deletion cascades completely**
    - **Validates: Requirements 10.3**

  - [ ] 13.5 Write property test: friend deletion unlinks all group members
    - **Property 12: Friend deletion unlinks all group members**
    - **Validates: Requirements 10.4**

- [ ] 14. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [-] 15. Login/Logout Experience (Change 2)
  - [x] 15.1 Update `auth.store.ts` to persist `lastAccount`
    - Add `lastAccount: { accountId: string; displayName: string } | null` to store
    - On `logout()`: set `lastAccount` from current `user`, then clear `user`
    - Add `clearLastAccount()` action
    - _Requirements: 2.1_

  - [x] 15.2 Redesign `LoginPage.tsx` to support recent account view
    - Read `lastAccount` from auth store
    - If `lastAccount` exists: show account name + four action buttons
    - If no `lastAccount`: show existing name-entry form
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.11_

  - [x] 15.3 Implement "Forget This Account" flow in `LoginPage.tsx`
    - Multi-step warning modal with Cancel, Export & Delete, Delete Without Export
    - "Export & Delete": export JSON, delete all data, clear lastAccount, navigate to clean form
    - "Delete Without Export": delete all data, clear lastAccount, navigate to clean form
    - Reuse `deleteAccountData()` from `accounts.db.ts`
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 15.4 Implement "Import Account Data" action on login screen
    - File picker trigger, reuse `parseImportFile` + `importAllData`
    - On success: set user from imported account, navigate to dashboard
    - _Requirements: 2.5_

- [ ] 16. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required
- All database mutations are in `*.db.ts` functions; pages call these functions
- Sync operations (Changes 7) use Dexie transactions for atomicity
- The login page redesign (Task 15) is the most complex task; it requires store changes before UI work
- Property tests use Vitest with manual random input generation (arrays of test cases)
