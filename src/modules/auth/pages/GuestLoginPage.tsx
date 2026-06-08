import { useNavigate } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { GuestLoginForm } from "../components/GuestLoginForm"

export function GuestLoginPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Enter a display name to continue as a guest. No account needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuestLoginForm onSuccess={() => navigate("/", { replace: true })} />
        </CardContent>
      </Card>
    </div>
  )
}
