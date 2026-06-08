import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { GuestLoginPage } from "@/src/modules/auth/pages/GuestLoginPage"
import { useAuthStore } from "@/src/modules/auth/store/auth.store"

function App() {
  const user = useAuthStore((state) => state.user)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<GuestLoginPage />} />
        <Route path="*" element={user ? <Navigate to="/" replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
