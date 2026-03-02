import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { fetchMe, resendVerification, verifyEmail } from "@/lib/api";
import { isAdminAppHost } from "@/lib/runtime";

const VerifyEmailPage = () => {
  const { t } = useI18n();
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
        toast.success(t("verify.success.redirecting", "Email verified. Redirecting to dashboard."));
        navigate(adminHost ? "/admin" : "/dashboard", { replace: true });
        return;
      }

      toast.success(t("verify.success.canSignIn", "Email verified. You can now sign in."));
      navigate(adminHost ? "/admin/login" : "/login", { replace: true });
    },
    [adminHost, navigate, t],
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
        const message = error instanceof Error ? error.message : t("verify.error.failed", "Verification failed.");
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
  }, [completeVerification, keyFromQuery, t]);

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!key) {
      toast.error(t("verify.error.keyRequired", "Verification key is required."));
      return;
    }

    setLoading(true);
    try {
      await completeVerification(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("verify.error.failed", "Verification failed.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error(t("verify.error.emailRequired", "Email is required."));
      return;
    }

    setLoading(true);
    try {
      await resendVerification(email);
      toast.success(t("verify.success.sent", "Verification email sent."));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("verify.error.resendFailed", "Could not resend verification email.");
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
            <h1 className="font-display text-3xl font-semibold text-foreground">{t("verify.title", "Verify Email")}</h1>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {t("verify.subtitle", "Paste your verification key or open the link you received by email.")}
          </p>

          <form onSubmit={handleVerify} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key" className="font-ui">{t("verify.key", "Verification key")}</Label>
              <Input id="key" value={key} onChange={(e) => setKey(e.target.value)} className="font-ui" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("verify.verifying", "Verifying...") : t("verify.verify", "Verify")}
            </Button>
          </form>

          <div className="mt-6 border-t border-border/70 pt-5">
            <p className="font-ui text-sm text-muted-foreground">{t("verify.resendPrompt", "Did not receive an email?")}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder={t("verify.emailPlaceholder", "you@example.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="font-ui"
              />
              <Button type="button" variant="outline" onClick={handleResend} disabled={loading}>
                {t("verify.resend", "Resend")}
              </Button>
            </div>
          </div>

          <p className="mt-5 text-center font-ui text-sm text-muted-foreground">
            {t("verify.alreadyVerified", "Verified already?")}{" "}
            <Link className="underline-offset-4 hover:underline" to="/login">
              {t("verify.signIn", "Sign in")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;



