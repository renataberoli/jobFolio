"use client";
/* Full navigation reloads the server session and profile-scoped state. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination */
import { useEffect, useState } from "react";
import { LockKeyhole, UserRound, Plus, LogOut } from "lucide-react";
type Profile = { id: string; name: string };
async function access(payload: object) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { next?: string; error?: string };
  if (!response.ok) throw new Error(data.error || "Could not sign in.");
  window.location.assign(data.next || "/");
}
function Brand() {
  return <a className="navbar-brand" href="/" aria-label="Jobfolio home"><img src="/jobfolio-logo.svg" width={40} height={40} alt=""/><span>Jobfolio</span></a>;
}
export function PinLogin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="access-shell">
      <Brand />
      <section className="access-card">
        <span className="access-icon">
          <LockKeyhole size={28} />
        </span>
        <h1>Sign in to Jobfolio</h1>
        <p>Enter your access PIN to choose a profile and continue.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await access({ action: "login", pin });
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Try again.",
              );
              setBusy(false);
            }
          }}
        >
          <label className="access-field">
            <span>Access PIN</span>
            <input
              type="password"
              autoFocus
              required
              maxLength={64}
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={busy}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy || !pin}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
export function ProfilePicker() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profiles", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          profiles: Profile[];
          error?: string;
        };
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error(data.error);
        setProfiles(data.profiles);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  async function submit(payload: object) {
    setBusy(true);
    setError("");
    try {
      await access(payload);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Try again.");
      setBusy(false);
    }
  }
  return (
    <main className="access-shell profile-shell">
      <Brand />
      <section className="access-card">
        <h1>{creating ? "Create your profile" : "Who is using Jobfolio?"}</h1>{!creating&&<p>Choose a profile to open its applications.</p>}
        {loading ? (
          <p role="status">Loading profiles…</p>
        ) : creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit({ action: "create", name });
            }}
          >
            <label className="access-field">
              <span>Name</span>
              <input
                autoFocus
                required
                maxLength={60}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="form-actions">
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setCreating(false);
                  setError("");
                }}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Creating…" : "Create profile"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="profile-grid">
              {profiles.map((profile) => (
                <button
                  className="profile-choice"
                  key={profile.id}
                  disabled={busy}
                  onClick={() =>
                    void submit({ action: "select", profileId: profile.id })
                  }
                >
                  <UserRound size={28} />
                  <span>{profile.name}</span>
                </button>
              ))}
            </div>
            <button
              className="button primary create-profile"
              disabled={busy}
              onClick={() => {
                setCreating(true);
                setError("");
              }}
            >
              <Plus size={18} />
              Create profile
            </button>
          </>
        )}
        {error && (
          <div role="alert">
            <p className="form-error">{error}</p>
            {!creating && !loading && (
              <button
                className="text-link"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
        <form className="profile-sign-out" action="/api/auth" method="post">
          <input type="hidden" name="action" value="logout" />
          <button className="text-link" disabled={busy}>
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
