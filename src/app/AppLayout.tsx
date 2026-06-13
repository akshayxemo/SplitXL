import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Receipt,
  Tags,
  Users,
  UserRound,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Menu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmationModal } from "@/components/ConfirmationModal"
import { LogoPlaceholder } from "@/components/LogoPlaceholder"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth.store"
import { useUIStore } from "@/stores/ui.store"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/friends", label: "Friends", icon: UserRound },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
]

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <LogoPlaceholder />
          <span className="text-lg font-semibold text-primary">SplitXL</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{user?.displayName}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setConfirmLogout(true)}>
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
            <Menu className="size-5" />
          </Button>
          <LogoPlaceholder className="size-6" />
          <span className="font-semibold">SplitXL</span>
        </header>

        <main className="flex-1 p-4 pb-20 md:p-6">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card md:hidden">
          {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <ConfirmationModal
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Log out?"
        description="You will need to sign in again to access your data."
        confirmLabel="Log out"
        onConfirm={handleLogout}
      />
    </div>
  )
}
