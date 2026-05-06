"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { safePostLoginPath } from "@/lib/safe-post-login-path";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    // Hard navigation: App Router's router.replace() can occasionally leave the
    // client stuck on "Redirecting…" when a session already exists.
    const next = safePostLoginPath(
      new URLSearchParams(window.location.search).get("next")
    );
    window.location.replace(next);
  }, [loading, user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(safePostLoginPath(next));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  if (!loading && user) {
    return (
      <p className="text-sm text-white/80" aria-live="polite">
        Redirecting…
      </p>
    );
  }

  return (
    <div className="relative z-[1] w-full max-w-md">
      <div className="mb-8 text-center sm:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-3xl">
          Office Letter Management
        </h1>
        <p className="mt-2 text-sm font-medium tracking-wide text-cyan-100/95 uppercase sm:text-xs">
          Integrated Letter Tracking &amp; Approval System
        </p>
      </div>

      <Card
        className={cn(
          "border-0 shadow-2xl ring-1 ring-white/15",
          "bg-[#123f63]/95 text-white backdrop-blur-sm"
        )}
      >
        <CardHeader className="space-y-1 border-b border-white/10 pb-4 text-center">
          <CardTitle className="sr-only">Sign in</CardTitle>
          <CardDescription className="text-sm text-cyan-100/90">
            Sign in with your assigned credentials. Your session is stored
            securely in this browser.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4 pt-6">
            {error ? (
              <p
                className="rounded-md border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-cyan-50/95">
                Email or username
              </Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 border-white/20 bg-white text-[#123f63] placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-cyan-50/95">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 border-white/20 bg-white text-[#123f63] placeholder:text-slate-500"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-white/10 pt-2">
            <Button
              type="submit"
              disabled={pending}
              className="h-10 w-full border-0 bg-cyan-500 font-semibold text-white shadow-md hover:bg-cyan-400"
            >
              {pending ? "Signing in…" : "Login"}
            </Button>
            <p className="text-center text-[11px] text-cyan-200/80">
              Authorized government and office use only.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
