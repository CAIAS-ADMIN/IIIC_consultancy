import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects unauthenticated browser navigation to
  // /api/auth/signin before this ever renders, but a Server Action or an
  // expired-mid-session request can still reach here, so this check is the
  // real (defensive) gate, not just a convenience.
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  return (
    <AppShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        roles: session.user.roles,
      }}
    >
      {children}
    </AppShell>
  );
}
