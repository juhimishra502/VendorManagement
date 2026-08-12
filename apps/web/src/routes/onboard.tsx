import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { acceptInvitation, claimInvitation } from "../lib/vendors.js";
import { Button, Card, ErrorText, Field, TextInput } from "../components/ui.js";

type Phase = "validating" | "error" | "needAuth" | "claiming";

/** Secure onboarding entry point. Reached from the emailed invitation link. */
export function OnboardPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading, signIn, signUp, signOut, refresh } = useAuth();

  const [phase, setPhase] = useState<Phase>("validating");
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<{ vendorId: string; email: string } | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Step 1: validate the token (marks opened + sets IN_PROGRESS server-side).
  useEffect(() => {
    acceptInvitation(token)
      .then(setInvited)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "This onboarding link is not valid");
        setPhase("error");
      });
  }, [token]);

  // Step 2: once validated + auth known, either claim or ask the vendor to sign in.
  useEffect(() => {
    if (!invited || loading) return;
    const matches = user && user.email.toLowerCase() === invited.email.toLowerCase();
    if (matches) {
      setPhase("claiming");
      claimInvitation(token)
        .then(async ({ vendorId }) => {
          await refresh();
          navigate(`/vendors/${vendorId}/portal`, { replace: true });
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Could not open onboarding");
          setPhase("error");
        });
    } else {
      setPhase("needAuth");
    }
  }, [invited, loading, user, token, navigate, refresh]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!invited) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(name, invited.email, password);
      else await signIn(invited.email, password);
      // the auth effect above will claim + redirect once `user` updates
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "error") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <Card className="max-w-md text-center">
          <p className="text-lg font-semibold text-slate-900">Onboarding link problem</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <p className="mt-3 text-xs text-slate-400">Please contact your procurement contact for a new invitation.</p>
        </Card>
      </div>
    );
  }

  if (phase === "validating" || phase === "claiming" || !invited) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Opening your onboarding…</div>;
  }

  // needAuth
  const wrongUser = user && user.email.toLowerCase() !== invited.email.toLowerCase();
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Supplier onboarding</p>
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === "signup" ? "Create your account" : "Sign in to continue"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You were invited as <span className="font-medium">{invited.email}</span>.
        </p>

        {wrongUser && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You are signed in as {user!.email}. Please{" "}
            <button className="font-semibold underline" onClick={() => void signOut()}>
              sign out
            </button>{" "}
            and continue as {invited.email}.
          </p>
        )}

        <form className="mt-4 space-y-4" onSubmit={authenticate}>
          {mode === "signup" && (
            <Field label="Your name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>
          )}
          <Field label="Email">
            <TextInput value={invited.email} readOnly className="bg-slate-50" />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-indigo-600 hover:underline"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "First time? Create an account"}
        </button>
      </Card>
    </div>
  );
}
