const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

export function formatINR(paise: number): string {
  return INR_FORMATTER.format(paiseToRupees(paise))
}

export function parseINR(input: string): number {
  const cleaned = input.replace(/[^\d.-]/g, "")
  const value = Number.parseFloat(cleaned)
  if (Number.isNaN(value) || value < 0) return 0
  return rupeesToPaise(value)
}

export function sumPaise(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0)
}

export function budgetUtilization(spentPaise: number, budgetPaise?: number): number {
  if (!budgetPaise || budgetPaise <= 0) return 0
  return Math.min(100, Math.round((spentPaise / budgetPaise) * 100))
}
