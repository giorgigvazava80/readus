import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchMe, resendVerification, verifyEmail } from "@/lib/api";
import { isAdminAppHost } from "@/lib/runtime";

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const adminHost = isAdminAppHost();
  const [searchParams] = useSearchParams();
  const keyFromQuery = useMemo(() => searchParams.get("key") || "", [searchParams]);

  const [key, setKey] = useState(keyFromQuery);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const completeVerification = useCallback(
    async (verificationKey: string) => {
      const response = await verifyEmail(verificationKey);
      const hasAuthToken = Boolean(response.access || response.key);

      if (hasAuthToken) {
        await fetchMe();
        toast.success("Email verified. Redirecting to dashboard.");
        navigate(adminHost ? "/admin" : "/dashboard", { replace: true });
        return;
      }

      toast.success("Email verified. You can now sign in.");
      navigate(adminHost ? "/admin/login" : "/login", { replace: true });
    },
    [adminHost, navigate],
  );

  useEffect(() => {
    if (!keyFromQuery) {
      return;
    }

    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        await completeVerification(keyFromQuery);
      } catch (error) {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : "Verification failed.";
        toast.error(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [completeVerification, keyFromQuery]);

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!key) {
      toast.error("Verification key is required.");
      return;
    }

    setLoading(true);
    try {
      await completeVerification(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error("Email is required.");
      return;
    }

    setLoading(true);
    try {
      await resendVerification(email);
      toast.success("Verification email sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not resend verification email.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,hsl(var(--primary)/0.13),transparent_34%),radial-gradient(circle_at_85%_15%,hsl(var(--accent)/0.1),transparent_28%)]" />
      <div className="container relative mx-auto flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-3xl font-semibold text-foreground">Verify Email</h1>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            Paste your verification key or open the link you received by email.
          </p>

          <form onSubmit={handleVerify} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key" className="font-ui">Verification key</Label>
              <Input id="key" value={key} onChange={(e) => setKey(e.target.value)} className="font-ui" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="mt-6 border-t border-border/70 pt-5">
            <p className="font-ui text-sm text-muted-foreground">Didn&apos;t receive the email?</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="font-ui"
              />
              <Button type="button" variant="outline" onClick={handleResend} disabled={loading}>
                Resend
              </Button>
            </div>
          </div>

          <p className="mt-5 text-center font-ui text-sm text-muted-foreground">
            Verified already?{" "}
            <Link className="underline-offset-4 hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
