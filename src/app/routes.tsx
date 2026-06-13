import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/app/AppLayout"
import { LoginPage } from "@/features/auth/LoginPage"
import { useAuthStore } from "@/stores/auth.store"
import { HomePage } from "@/features/home/HomePage"

const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage }))
)
const ExpensesPage = lazy(() =>
  import("@/features/expenses/ExpensesPage").then((m) => ({ default: m.ExpensesPage }))
)
const CategoriesPage = lazy(() =>
  import("@/features/categories/CategoriesPage").then((m) => ({ default: m.CategoriesPage }))
)
const GroupsPage = lazy(() =>
  import("@/features/groups/GroupsPage").then((m) => ({ default: m.GroupsPage }))
)
const GroupDetailPage = lazy(() =>
  import("@/features/groups/GroupDetailPage").then((m) => ({ default: m.GroupDetailPage }))
)
const FriendsPage = lazy(() =>
  import("@/features/friends/FriendsPage").then((m) => ({ default: m.FriendsPage }))
)
const InsightsPage = lazy(() =>
  import("@/features/insights/InsightsPage").then((m) => ({ default: m.InsightsPage }))
)
const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage }))
)
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage }))
)

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      Loading...
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function CatchAll() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={user ? "/dashboard" : "/"} replace />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <HomePage />
            </PublicRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<CatchAll />} />
      </Routes>
    </Suspense>
  )
}
