import { useEffect } from "react"
import { BrowserRouter } from "react-router-dom"
import { AppRoutes } from "@/app/routes"
import { initializeDatabase } from "@/lib/db-migrate"
import { applyTheme, useUIStore } from "@/stores/ui.store"

function App() {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    void initializeDatabase()
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
