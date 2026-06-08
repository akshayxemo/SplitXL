import { create } from "zustand"

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

export const useUIStore = create<UIState>()((set) => ({
  theme: "system",
  sidebarOpen: true,
  activeGroupId: null,

  setTheme: (theme) => set({ theme }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveGroupId: (id) => set({ activeGroupId: id }),
}))
