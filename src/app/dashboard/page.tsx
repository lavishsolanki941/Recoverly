import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="min-h-full flex-1 bg-background p-6 sm:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Frames the page with the same fixed dark anchor as the hero below
            it — deliberately not theme-reactive, see globals.css. */}
        <div className="flex items-center justify-between rounded-2xl bg-anchor px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-anchor-foreground">Recoverly</h1>
            <p className="text-sm text-anchor-muted">Signed in as {session?.user?.email}</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="!border-anchor-foreground/25 !bg-transparent !text-anchor-foreground hover:!bg-anchor-foreground/10"
            >
              Sign out
            </Button>
          </form>
        </div>

        <DashboardContent />
      </div>
    </main>
  );
}
