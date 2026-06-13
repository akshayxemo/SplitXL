import { useNavigate } from "react-router-dom";
import { LogoPlaceholder } from "@/components/LogoPlaceholder";
import { Button } from "@/components/ui/button";
import { Wallet, Users, PieChart, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="dark min-h-screen bg-[#0a0a0a]">
      <main className="container mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <LogoPlaceholder
          src="/logo-horizontal.png"
          className="mb-8 h-18 md:h-28"
        />

        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-white">
            Simplify Expense Tracking &
            <span className="text-primary"> Group Settlements</span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Track personal expenses, manage group trips, split bills, settle
            balances, generate reports, and keep everything stored securely on
            your own device.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/login")}>
              Get Started
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/login")}
              className={cn("text-gray-300 hover:text-white")}
            >
              Continue as Guest
            </Button>
          </div>
        </div>

        <div className="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-5">
            <Wallet className="mb-3 size-8 text-primary" />
            <h3 className="font-semibold text-white">Personal Finance</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Track daily expenses, refunds, rewards and spending trends.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <Users className="mb-3 size-8 text-primary" />
            <h3 className="font-semibold text-white">Group Splitting</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage trips, events and shared expenses with friends.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <PieChart className="mb-3 size-8 text-primary" />
            <h3 className="font-semibold text-white">Insights & Reports</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Visualize spending with charts, summaries and PDF reports.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <Smartphone className="mb-3 size-8 text-primary" />
            <h3 className="font-semibold text-white">Local & Private</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No cloud required. Your data stays on your device.
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          No signup required • Works offline • Install as a PWA
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground  pt-4 border-t border-gray-500/50 w-full">
          Built by Akshay | Open Source on{" "}
          <a
            href="https://github.com/akshayxemo/SplitXL"
            target="_blank"
            className="text-gray-200 hover:text-white"
          >
            Github
          </a>
        </p>
      </main>
    </div>
  );
};
