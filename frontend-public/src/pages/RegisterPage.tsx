import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Eye, EyeOff, Feather, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { register, resendVerification } from "@/lib/api";
import { createGoogleOAuthState, GOOGLE_OAUTH_SCOPE } from "@/lib/oauth";
import type { RegisteredRole } from "@/lib/types";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

const RegisterPage = () => {
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<RegisteredRole>("reader");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const emailVerificationRequired = import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED === "1";
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleRedirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/login`;

  const strength = getPasswordStrength(password);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username || !email || !firstName || !lastName || !password || !password2) {
      toast.error(t("register.error.required", "Fill all required fields."));
      return;
    }
    if (password !== password2) {
      toast.error(t("register.error.passwordMatch", "Passwords do not match."));
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, firstName, lastName, password, password2, role });
      setRegisteredEmail(email);
      toast.success(
        emailVerificationRequired
          ? t("register.success", "Registration successful. Verify your email to activate your account.")
          : t("register.successNoVerification", "Registration successful. You can sign in now."),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("register.error.failed", "Registration failed.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) {
      toast.error(t("register.error.resendBefore", "Register first before requesting another verification email."));
      return;
    }
    try {
      await resendVerification(registeredEmail);
      toast.success(t("register.success.resent", "Verification email sent again."));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("register.error.resendFailed", "Failed to resend verification.");
      toast.error(message);
    }
  };

  const handleGoogleRegister = () => {
    if (!googleClientId) {
      toast.error(t("register.error.googleNotConfigured", "Google authentication is not configured."));
      return;
    }
    const state = createGoogleOAuthState();
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri,
      response_type: "code",
      scope: GOOGLE_OAUTH_SCOPE,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "select_account",
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // Registered success state
  if (registeredEmail && emailVerificationRequired) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,hsl(var(--primary)/0.14),transparent_36%)]" />
        <Navbar />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/85 p-8 shadow-card text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground">Check your email</h2>
            <p className="mt-3 font-ui text-sm text-muted-foreground">
              We sent a verification link to <strong className="text-foreground">{registeredEmail}</strong>. Click it to activate your account.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={handleResend} variant="outline" className="w-full h-11 font-ui">
                Resend verification email
              </Button>
              <Link to="/login">
                <Button className="w-full h-11 font-ui">Go to Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_92%_10%,hsl(var(--accent)/0.1),transparent_32%)]" />
      <Navbar />
      <div className="container relative mx-auto grid min-h-[calc(100vh-4rem)] items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">

        {/* Left panel */}
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/75 px-4 py-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("register.badge", "Create your Readus account")}</span>
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-tight text-foreground">
              {t("register.title", "Reader First. Writer by Approval.")}
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-muted-foreground">
              {t("register.subtitle", "Reader registration unlocks public reading, reviews, likes, and comments. Writers go through an editorial approval process before publication rights are granted.")}
            </p>
            <div className="mt-7 grid gap-3">
              <div className={`rounded-xl border-2 p-4 shadow-card transition-all ${role === "reader" ? "border-primary bg-primary/5" : "border-border/70 bg-card/75"}`}>
                <p className="font-display text-lg font-semibold text-foreground">{t("register.readerCardTitle", "Reader")}</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">{t("register.readerCardDesc", "Review, like, comment, and follow published works.")}</p>
              </div>
              <div className={`rounded-xl border-2 p-4 shadow-card transition-all ${role === "writer" ? "border-primary bg-primary/5" : "border-border/70 bg-card/75"}`}>
                <p className="font-display text-lg font-semibold text-foreground">{t("register.writerCardTitle", "Writer Track")}</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">{t("register.writerCardDesc", "Submit writing proof after verification and wait for editorial review.")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right form */}
        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-semibold text-foreground">{t("register.heading", "Create Account")}</h2>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {emailVerificationRequired
              ? t("register.note", "All accounts require email verification before access.")
              : t("register.noteNoVerification", "Accounts activate immediately.")}
          </p>

          {/* Role selector */}
          <div className="mt-5 space-y-2">
            <Label className="font-ui text-sm font-medium">{t("register.role", "I want to be a…")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["reader", "writer"] as RegisteredRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${role === r
                      ? "border-primary bg-primary/8 shadow-sm"
                      : "border-border/70 bg-background/60 hover:border-primary/40"
                    }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${role === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {r === "reader" ? <BookOpen className="h-4 w-4" /> : <Feather className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-ui text-sm font-semibold text-foreground capitalize">{r === "reader" ? t("register.roleReader", "Reader") : t("register.roleWriter", "Writer")}</p>
                    <p className="font-ui text-xs text-muted-foreground">{r === "reader" ? "Browse & comment" : "Write & publish"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Name row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-ui text-sm font-medium">{t("register.firstName", "First name")}</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 pl-9 font-ui" placeholder="Giorgi" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="font-ui text-sm font-medium">{t("register.lastName", "Last name")}</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 font-ui" placeholder="Surname" />
              </div>
            </div>

            {/* Username + Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-ui text-sm font-medium">{t("register.username", "Username")}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-ui text-sm text-muted-foreground">@</span>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 pl-7 font-ui" placeholder="username" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-ui text-sm font-medium">{t("register.email", "Email")}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-9 font-ui" placeholder="you@example.com" />
                </div>
              </div>
            </div>

            {/* Passwords */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="font-ui text-sm font-medium">{t("register.password", "Password")}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-9 pr-10 font-ui"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength bar */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${strength.score >= bar ? strength.color : "bg-border"
                            }`}
                        />
                      ))}
                    </div>
                    <p className="font-ui text-xs text-muted-foreground">{strength.label}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2" className="font-ui text-sm font-medium">{t("register.passwordRepeat", "Repeat password")}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password2"
                    type={showPassword ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className={`h-11 pl-9 font-ui ${password2 && password !== password2 ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                    placeholder="••••••••"
                  />
                </div>
                {password2 && password !== password2 && (
                  <p className="font-ui text-xs text-red-600">Passwords don't match</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full h-12 gap-2 font-ui text-base font-semibold" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  {t("register.creating", "Creating account…")}
                </span>
              ) : t("register.create", "Create Account")}
            </Button>
          </form>

          {/* Google */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 font-ui text-xs text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2 font-ui text-sm"
            onClick={handleGoogleRegister}
            disabled={loading || !googleClientId}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {t("register.googleContinue", "Continue with Google")}
          </Button>

          <div className="mt-4 flex items-center justify-between font-ui text-sm">
            <Link to="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("register.haveAccount", "Already have an account? Sign in")}
            </Link>
            {emailVerificationRequired && registeredEmail && (
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={handleResend}
              >
                {t("register.resend", "Resend verification")}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
