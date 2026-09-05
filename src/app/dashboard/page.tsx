import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="min-h-full flex-1 bg-background p-6 sm:p-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Recoverly</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {session?.user?.email}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>

        <DashboardContent />
      </div>
    </main>
  );
}
