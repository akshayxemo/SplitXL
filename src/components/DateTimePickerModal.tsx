import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DateTimePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string
  onChange: (isoDateTime: string) => void
  title?: string
}

export function DateTimePickerModal({
  open,
  onOpenChange,
  value,
  onChange,
  title = "Select date & time",
}: DateTimePickerModalProps) {
  const initial = value ? new Date(value) : new Date()
  const [date, setDate] = useState(format(initial, "yyyy-MM-dd"))
  const [time, setTime] = useState(format(initial, "HH:mm"))

  function handleApply() {
    const iso = new Date(`${date}T${time}:00`).toISOString()
    onChange(iso)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={handleApply}>Apply</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${format(d, "MMM d, yyyy")} · ${format(d, "h:mm a")}`
}

export function isoToDateString(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd")
}
