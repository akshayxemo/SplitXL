import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "light" | "dark" | "system"

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  activeGroupId: string | null
  setTheme: (theme: Theme) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActiveGroupId: (id: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarOpen: true,
      activeGroupId: null,
      setTheme: (theme) => set({ theme }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setActiveGroupId: (id) => set({ activeGroupId: id }),
    }),
    {
      name: "ui_prefs",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    root.classList.toggle("dark", prefersDark)
  } else {
    root.classList.toggle("dark", theme === "dark")
  }
}
