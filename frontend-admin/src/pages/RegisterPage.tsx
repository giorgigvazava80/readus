import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Feather } from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { register, resendVerification } from "@/lib/api";
import type { RegisteredRole } from "@/lib/types";

const RegisterPage = () => {
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [role, setRole] = useState<RegisteredRole>("reader");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

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
      toast.success(t("register.success", "Registration successful. Verify your email to activate account."));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("register.error.failed", "Registration failed.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) {
      toast.error(t("register.error.resendBefore", "Register first to resend verification."));
      return;
    }

    try {
      await resendVerification(registeredEmail);
      toast.success(t("register.success.resent", "Verification email resent."));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("register.error.resendFailed", "Failed to resend verification.");
      toast.error(message);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_92%_10%,hsl(var(--accent)/0.1),transparent_32%)]" />
      <Navbar />
      <div className="container relative mx-auto grid min-h-[calc(100vh-4rem)] items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/75 px-4 py-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">{t("register.badge", "Create your read us account")}</span>
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-tight text-foreground">
              {t("register.title", "Reader First. Writer by Approval.")}
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-muted-foreground">
              {t("register.subtitle", "Reader registration unlocks public reading, reviews, likes, and comments. If you choose writer, you will verify email and then complete the writer application before publication rights are granted.")}
            </p>
            <div className="mt-7 grid gap-3">
              <div className="rounded-xl border border-border/70 bg-card/75 p-4 shadow-card">
                <p className="font-display text-lg font-semibold text-foreground">{t("register.readerCardTitle", "Reader")}</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">{t("register.readerCardDesc", "Review, like, comment, and follow published works.")}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/75 p-4 shadow-card">
                <p className="font-display text-lg font-semibold text-foreground">{t("register.writerCardTitle", "Writer Track")}</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">{t("register.writerCardDesc", "Submit writing proof after verification and wait for editorial review.")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-semibold text-foreground">{t("register.heading", "Register")}</h2>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {t("register.note", "All accounts require email verification before access.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-ui">{t("register.firstName", "First name")}</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="font-ui" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="font-ui">{t("register.lastName", "Last name")}</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="font-ui" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-ui">{t("register.username", "Username")}</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-ui">{t("register.email", "Email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="font-ui" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-ui">{t("register.role", "Role")}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as RegisteredRole)}>
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reader">{t("register.roleReader", "Reader")}</SelectItem>
                  <SelectItem value="writer">{t("register.roleWriter", "Writer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="font-ui">{t("register.password", "Password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-ui"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2" className="font-ui">{t("register.passwordRepeat", "Repeat password")}</Label>
                <Input
                  id="password2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="font-ui"
                />
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? t("register.creating", "Creating account...") : t("register.create", "Create Account")}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm font-ui">
            <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/login">
              {t("register.haveAccount", "Already have an account?")}
            </Link>
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={handleResend}
            >
              {t("register.resend", "Resend verification")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
