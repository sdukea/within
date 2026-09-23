import { FormEvent, useState } from "react";
import { api, setToken, type User } from "./api";
import { ArrowIcon } from "./Icons";
import { Logo } from "./Logo";
import { ErrorState } from "./Status";

type Props = { onAuthenticated: (user: User) => void };

export function Login({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, user } =
        mode === "login" ? await api.login(email, password) : await api.register(email, password);
      setToken(token);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-paper px-6">
      <div className="w-full max-w-[340px]">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo className="h-6 w-6 text-ink-950" aria-label="Within" />
          <span className="font-serif text-[19px] italic text-ink-950">Within</span>
        </div>

        <h1 className="mb-1 text-[17px] font-medium text-ink-950">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-6 text-[13px] text-ink-500">
          {mode === "login"
            ? "Sign in to reach your projects."
            : "Your projects stay private to your account."}
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-md border border-ink-200 bg-paper-raised px-3 text-[14px] text-ink-950 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-md border border-ink-200 bg-paper-raised px-3 text-[14px] text-ink-950 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
            {mode === "register" ? (
              <p className="mt-1 text-[11px] text-ink-500">At least 8 characters.</p>
            ) : null}
          </div>

          {error ? <ErrorState message={error} /> : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-ink-950 text-[13.5px] font-medium text-white transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {loading ? (
              <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-breathe" />
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowIcon className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="mt-5 text-[12.5px] text-ink-500 transition-colors duration-150 hover:text-ink-950"
        >
          {mode === "login" ? "New to Within? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
