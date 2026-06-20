import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

/**
 * Admin login (doc 10 §4.2). PUBLIC — lives at `/admin-login` (outside
 * `app/admin`), so middleware never gates it. `noindex,nofollow`. If already
 * signed in, bounce straight to `/admin`. Bare centered branded card (no shell).
 */

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Reads the session cookie → dynamic (never prerendered).
export const dynamic = "force-dynamic";

function safeNext(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  if (!value.startsWith("/admin")) return undefined;
  if (value.startsWith("/admin-login")) return undefined;
  if (value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Already authenticated → skip the form.
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");

  const sp = await searchParams;
  const next = safeNext(sp.next);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-pastel-pink/20 via-background to-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-6" />
          </span>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            GooglyWoogly Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your command center
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          GooglyWoogly Art · Handmade in Jaipur
        </p>
      </div>
    </main>
  );
}
