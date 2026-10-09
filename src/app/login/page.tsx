"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkMessage, setLinkMessage] = useState("");

  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin";

  useEffect(() => {
    const linkError = searchParams.get("error");
    if (linkError === "expired") {
      setError("Sign-in link expired or invalid. Request a new one below.");
    }
  }, [searchParams]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkLoading(true);
    setError("");
    setLinkMessage("");

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: redirectTo }),
      });
      const data = await response.json();
      if (data.success) {
        setLinkMessage(data.message || "Check your email for a sign-in link.");
      } else {
        setError(data.error || "Could not send sign-in link");
      }
    } catch (err) {
      console.error("Magic link error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-8" style={{ backgroundColor: 'var(--background-tertiary)' }}>
      <div className="max-w-md mx-auto space-y-4">
        <div className="retro-window">
          <div className="retro-title-bar">[ LOGIN.EXE ]</div>
          <div className="p-4 m-2">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-foreground">
                &gt; ADMIN SIGN-IN
              </h2>
              <p className="text-sm text-foreground-secondary mt-2">
                Enter your email; we&apos;ll send a one-time link (allowlisted admins only).
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleMagicLink}>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm text-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="retro-input w-full"
                  placeholder="user@example.com"
                />
              </div>

              {error && (
                <div role="alert" className="form-error p-2 bg-background-tertiary text-sm text-center">
                  {error}
                </div>
              )}

              {linkMessage && (
                <div role="status" className="form-status p-2 bg-background-tertiary text-sm text-center">
                  {linkMessage}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={linkLoading || !email}
                  className="retro-button w-full disabled:opacity-50"
                >
                  {linkLoading ? "[ SENDING LINK... ]" : "[ EMAIL ME A SIGN-IN LINK ]"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-tertiary)' }}>
          <div className="retro-window">
            <div className="retro-title-bar">[ LOADING... ]</div>
            <div className="p-8 text-center">
              <p className="text-foreground">PLEASE WAIT...</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
