import { useEffect } from "react"
import { BrowserRouter } from "react-router-dom"
import { AppRoutes } from "@/app/routes"
import { initializeDatabase } from "@/lib/db-migrate"
import { applyTheme, useUIStore } from "@/stores/ui.store"
import { useAuthStore } from "@/stores/auth.store"
import { getAccountId } from "@/lib/db"
import { syncAuthAccount } from "@/lib/db-migrate"
import { Analytics } from "@vercel/analytics/react"

function App() {
  const theme = useUIStore((s) => s.theme)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    void initializeDatabase()
  }, [])

  useEffect(() => {
    if (user) {
      void syncAuthAccount(getAccountId(user), user.displayName)
    }
  }, [user])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <BrowserRouter>
      <Analytics />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
