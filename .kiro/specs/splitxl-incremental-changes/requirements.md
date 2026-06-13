# Requirements Document

## Introduction

SplitXL is a local-first expense splitting PWA. This document covers 12 incremental improvements to the existing codebase: profile auto-save, login/logout UX with account recall and deletion, category system improvements, date/time field consolidation, insights labeling, friend management (edit/view/sync), friend selection UX, category display consistency, data integrity tightening, transaction timeline improvements, and overall UX consistency across all entities.

No schema migrations are required — all changes are UI and application-layer logic.

## Glossary

- **System Category**: A category with `scope: "global"` seeded at first-run. Cannot be deleted.
- **Custom Category**: A category with `scope: "personal"` or `scope: "group"` created by the user. Can be deleted.
- **Linked Member**: A `GroupMember` with a non-null `linkedFriendId`.
- **Standalone Member**: A `GroupMember` with `linkedFriendId = null`.
- **Friend**: A record in `db.friends` representing a global contact owned by an account.
- **Account**: The active local identity stored in `db.accounts` and `localStorage` via Zustand.
- **Transaction**: A record in `db.transactions` of type `expense`, `refund`, or `settlement_payment`.
- **Settlement Progress**: `Settled Amount / Total Debt` expressed as a percentage.

---

## Requirements

### Requirement 1 — Profile Auto-Save

**User Story:** As a user, I want my profile changes to save automatically without a dedicated button, so that editing my name, email, or phone is frictionless.

#### Acceptance Criteria

1. THE Settings page SHALL NOT display a dedicated "Save Profile" button.
2. WHEN a user submits the profile form (via Enter or a submit button within the form), THE Settings Page SHALL persist name, email, and phone to the database and Zustand store.
3. WHEN the profile is saved successfully, THE Settings Page SHALL display a brief success message.
4. IF the save fails, THEN THE Settings Page SHALL display an error message.

---

### Requirement 2 — Logout and Login Experience

**User Story:** As a user, I want the login screen to show my most recent account after logout, so that I can quickly resume or start fresh.

#### Acceptance Criteria

1. WHEN a user logs out, THE Login Page SHALL display the last active account's display name.
2. WHEN a prior account is displayed, THE Login Page SHALL offer: "Continue as Existing Account", "Create New Account", "Import Account Data", and "Forget This Account" actions.
3. WHEN "Continue as Existing Account" is selected, THE Login Page SHALL restore the prior account and navigate to the dashboard.
4. WHEN "Create New Account" is selected, THE Login Page SHALL show the name-entry form for a new account.
5. WHEN "Import Account Data" is selected, THE Login Page SHALL trigger the file import flow.
6. WHEN "Forget This Account" is selected, THE Login Page SHALL show a critical warning modal.
7. WHEN the warning modal is shown, THE Modal SHALL offer three actions: "Cancel", "Export & Delete", and "Delete Without Export".
8. WHEN "Export & Delete" is confirmed, THE System SHALL export all account data to a JSON file, then delete all data associated with the account, then clear the auth session.
9. WHEN "Delete Without Export" is confirmed, THE System SHALL delete all data associated with the account, then clear the auth session.
10. WHEN account data is deleted, THE System SHALL remove all records in: accounts, friends, categories (personal and group-scoped), personalExpenses, groupMembers, transactions, groups, settlements, settings, and appMeta — with no orphaned IndexedDB records remaining.
11. WHEN no prior account exists, THE Login Page SHALL display only the "Create New Account" form.

---

### Requirement 3 — Category System Improvements

**User Story:** As a user, I want categories to have meaningful default emojis and to be fully editable (name and emoji), so that expense categorization is clear and personalized.

#### Acceptance Criteria

1. THE System SHALL seed the following default global categories on first run: 🍔 Food, 🚕 Transport, 🏨 Hotel, 🎟️ Tickets, 🛒 Shopping, 🎮 Entertainment, 💊 Medical, 🏠 Rent, 📚 Education, ✈️ Travel.
2. THE Categories Page SHALL NOT display a color picker.
3. WHEN editing a category (system, global custom, personal, or group-scoped), THE Categories Page SHALL allow editing both the name and emoji fields.
4. WHEN a user attempts to delete a system category (scope: global), THE Categories Page SHALL reject the action and display an informative message.
5. WHEN a user attempts to delete a custom category (scope: personal or group), THE Categories Page SHALL show a confirmation modal before deleting.
6. WHEN a system category's edit button is activated, THE Categories Page SHALL allow editing name and emoji for system categories.

---

### Requirement 4 — Date and Time Field Consolidation

**User Story:** As a user, I want a single date and time selector on expense forms, so that I don't have to fill in redundant date fields.

#### Acceptance Criteria

1. THE Personal Expense form SHALL contain exactly one date/time input, implemented as the DateTimePickerModal component.
2. THE Personal Expense form SHALL NOT display a separate `<input type="date">` field alongside the DateTimePickerModal.
3. THE Group Expense form SHALL contain exactly one date/time input implemented as the DateTimePickerModal.
4. THE Refund form, WHERE present, SHALL use the DateTimePickerModal.
5. THE Settlement form, WHERE present, SHALL use the DateTimePickerModal.

---

### Requirement 5 — Insights Clarification and Labeling

**User Story:** As a user, I want every chart and metric to show what it represents, how it is calculated, and its time period, so that I can interpret data without ambiguity.

#### Acceptance Criteria

1. WHEN a chart is displayed, THE Insights Page SHALL show the chart title, the metric being measured, and the time period covered.
2. THE Member Insights section SHALL display the following as separate labeled metrics: Amount Paid (money paid by that member), Amount Consumed (member's expense share), Net Position (receivable if positive, payable if negative), and Expense Count (number of transactions participated in).
3. THE Settlement Progress section SHALL display: Total Debt, Settled Amount, Remaining Amount, and Completion Percentage as separate labeled fields.
4. THE Settlement Progress section SHALL define Settlement Progress as: Settled Amount divided by Total Debt.

---

### Requirement 6 — Friend Management (View, Edit, Delete)

**User Story:** As a user, I want to view, edit, and delete friends, so that I can keep my contact list accurate.

#### Acceptance Criteria

1. THE Friends Page SHALL provide an edit action for each friend record.
2. WHEN a user activates the edit action on a friend, THE Friends Page SHALL display an edit form pre-populated with the friend's current name, email, phone, and notes.
3. WHEN a user saves edits to a friend, THE System SHALL validate that at least one of email or phone is provided.
4. IF neither email nor phone is provided on edit, THEN THE System SHALL reject the save and display a validation error.
5. THE Friends Page SHALL provide a view detail action for each friend record.
6. WHEN a user activates the view detail action, THE Friends Page SHALL display the friend's name, email, phone, notes, archived status, and created date.
7. THE Friends Page SHALL provide a delete action with a confirmation modal for each friend record.

---

### Requirement 7 — Friend and Member Synchronization

**User Story:** As a user, I want edits to a Friend to propagate to all linked group members, and edits to a linked member to propagate back to the Friend, so that contact data stays consistent.

#### Acceptance Criteria

1. WHEN a linked member (linkedFriendId is set) is updated, THE System SHALL update the corresponding Friend record with the same name, email, and phone.
2. WHEN a linked member is updated, THE System SHALL update all other group members linked to the same Friend with the new name, email, and phone.
3. WHEN a Friend is updated, THE System SHALL update all group members where linkedFriendId equals the Friend's id with the new name, email, and phone.
4. WHILE a member has linkedFriendId = null (standalone member), THE System SHALL update only that specific member when it is edited, with no global propagation.

---

### Requirement 8 — Friend Selection UX

**User Story:** As a user, I want to see a friend's name, phone, and email when selecting them as a group member, so that I can identify the right contact immediately.

#### Acceptance Criteria

1. WHEN a user opens the "Select Friend" dropdown in the group member add form, THE System SHALL display each friend's display name, email (if present), and phone (if present).
2. THE Friend selector SHALL visually distinguish each friend entry so that users can identify a friend's full contact context at a glance.

---

### Requirement 9 — Category Display Consistency

**User Story:** As a user, I want to see the emoji and name together wherever a category is shown, so that categories are immediately recognizable.

#### Acceptance Criteria

1. WHEN categories are shown in any dropdown or select input, THE System SHALL display both the emoji and name in the format: `{emoji} {name}`.
2. WHEN an expense is shown in the personal expense list, THE System SHALL display both the category emoji and name.
3. WHEN a transaction is shown in the group expense timeline (collapsed view), THE System SHALL display the category emoji.
4. WHEN a transaction is shown in the group expense timeline (expanded view), THE System SHALL display both the category emoji and name.
5. WHEN categories are shown in reports, THE System SHALL display both the emoji and name.
6. WHEN categories are shown in insights charts and labels, THE System SHALL display both the emoji and name.

---

### Requirement 10 — Data Integrity

**User Story:** As a developer, I want the database to be validated after all destructive operations, so that no orphaned records remain.

#### Acceptance Criteria

1. WHEN account data is deleted, THE System SHALL run a database integrity validation after the deletion completes.
2. WHEN data is imported (replace or merge mode), THE System SHALL run a database integrity validation after the import completes.
3. WHEN a group is deleted, THE System SHALL cascade-delete all associated transactions, group members, and group-scoped categories.
4. WHEN a friend is deleted, THE System SHALL unlink all group members with linkedFriendId equal to the deleted friend's id.
5. IF any integrity validation fails, THEN THE System SHALL surface the failure message to the user and, where applicable, roll back to a prior snapshot.

---

### Requirement 11 — Transaction Timeline Detail Improvements

**User Story:** As a user, I want the expense timeline to show all relevant details in collapsed and expanded views, so that I can understand each transaction without opening an edit form.

#### Acceptance Criteria

1. WHEN a transaction is shown in collapsed view, THE Timeline SHALL display: category emoji, title, amount, date/time, and the name of the member who paid.
2. WHEN a transaction is expanded, THE Timeline SHALL display: category (emoji + name), notes, split method, split breakdown (per-member share amounts), participants list, created date, updated date, and transaction type.
3. WHEN a transaction is shown in expanded view and the group is not read-only, THE Timeline SHALL provide Edit and Delete actions.
4. WHEN a user activates Delete on a transaction, THE Timeline SHALL show a confirmation modal before deleting.

---

### Requirement 12 — UX Consistency

**User Story:** As a user, I want consistent View, Edit, and Delete actions across all entities (Friend, Member, Category, Expense, Group), so that interactions are predictable.

#### Acceptance Criteria

1. THE Friends Page SHALL provide View, Edit, and Delete actions for each friend. Archive/restore remain as additional actions.
2. THE Group Members section SHALL provide a View Detail panel showing: name, email, phone, linked friend status, group participation count, and created date.
3. THE Group Members section SHALL provide an Edit action for each member, allowing name, email, and phone to be changed.
4. WHEN a user edits a group member, THE System SHALL apply the Friend/Member sync rules defined in Requirement 7.
5. WHEN a user removes a group member, THE System SHALL show a confirmation modal before removing.
6. THE Categories Page SHALL allow Delete only on custom categories, with a confirmation modal. System categories SHALL display an informative message if deletion is attempted.
7. WHEN any destructive action (delete, remove, forget account) is initiated, THE System SHALL always display a confirmation modal before executing.
