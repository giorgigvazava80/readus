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
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const emailVerificationRequired = import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED === "1";

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
      await register({ username, email, firstName, lastName, password, password2, role: "reader" });
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
            <h2 className="font-display text-2xl font-semibold text-foreground">{t("register.checkEmail", "Check your email")}</h2>
            <p className="mt-3 font-ui text-sm text-muted-foreground">
              {t("register.checkEmailDesc", "We sent a verification link to {email}. Click it to activate your account.").replace("{email}", "")}
              <strong className="text-foreground">{registeredEmail}</strong>
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={handleResend} variant="outline" className="w-full h-11 font-ui">
                {t("register.resendVerification", "Resend verification email")}
              </Button>
              <Link to="/login">
                <Button className="w-full h-11 font-ui">{t("register.goToSignIn", "Go to Sign In")}</Button>
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
      <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">

        {/* Registration form */}
        <section className="w-full max-w-lg rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-semibold text-foreground">{t("register.heading", "Create Account")}</h2>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {emailVerificationRequired
              ? t("register.note", "All accounts require email verification before access.")
              : t("register.noteNoVerification", "Accounts activate immediately.")}
          </p>

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

          <div className="mt-4 text-center font-ui text-sm">
            <Link to="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("register.haveAccount", "Already have an account? Sign in")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
