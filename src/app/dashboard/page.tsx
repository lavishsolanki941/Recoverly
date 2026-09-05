import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="min-h-full flex-1 bg-neutral-50 p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Recoverly Dashboard</h1>
            <p className="text-sm text-neutral-500">
              Signed in as {session?.user?.email}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No data yet</CardTitle>
            <CardDescription>
              Once webhooks start flowing, at-risk subscriptions, retry
              activity, and the cashflow forecast will show up here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
