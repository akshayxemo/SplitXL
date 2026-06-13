export type UpgradeTx = {
  table: (name: string) => {
    toArray: () => Promise<Record<string, unknown>[]>
    put: (item: Record<string, unknown>) => Promise<unknown>
    bulkPut: (items: Record<string, unknown>[]) => Promise<unknown>
    clear: () => Promise<void>
    delete: (key: string) => Promise<void>
  }
}
