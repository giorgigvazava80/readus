import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff, Lock, Shield, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { useI18n } from "@/i18n";
import { fetchMe, login, loginWithGoogleCode, logout } from "@/lib/api";
import { consumeGoogleOAuthState, createGoogleOAuthState, GOOGLE_OAUTH_SCOPE } from "@/lib/oauth";
import { isAdminAppHost } from "@/lib/runtime";

function resolvePostLoginPath(
  adminHost: boolean,
  me: { is_writer_approved: boolean; role_registered: "reader" | "writer" },
) {
  if (adminHost) return "/admin";
  return me.is_writer_approved || me.role_registered === "writer" ? "/dashboard" : "/";
}

const LoginPage = () => {
  const navigate = useNavigate();
  const adminHost = isAdminAppHost();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleRedirectUri =
    import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}${adminHost ? "/admin/login" : "/login"}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");

    if (oauthError) {
      consumeGoogleOAuthState();
      toast.error(t("login.error.googleFailed", "Google login failed: {error}").replace("{error}", oauthError));
      navigate(adminHost ? "/admin/login" : "/login", { replace: true });
      return;
    }

    if (!code) return;

    const expectedState = consumeGoogleOAuthState();
    const returnedState = params.get("state") || "";
    if (!expectedState || expectedState !== returnedState) {
      toast.error(t("login.error.googleStateInvalid", "Google login failed: invalid OAuth state."));
      navigate(adminHost ? "/admin/login" : "/login", { replace: true });
      return;
    }

    const normalizedCode = code.replace(/ /g, "+");
    const run = async () => {
      setLoading(true);
      try {
        await loginWithGoogleCode(normalizedCode, googleRedirectUri);
        const me = await fetchMe();
        if (!me) throw new Error(t("login.error.loadUser", "Failed to load current user."));
        if (adminHost && !(me.is_admin || me.is_redactor)) {
          await logout();
          throw new Error(t("login.error.noAdminAccess", "You do not have access to the admin portal."));
        }
        navigate(resolvePostLoginPath(adminHost, me), { replace: true });
        toast.success(t("login.success.google", "Signed in with Google."));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("login.error.failed", "Login failed.");
        toast.error(message);
        navigate(adminHost ? "/admin/login" : "/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [adminHost, googleRedirectUri, navigate, t]);

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      toast.error(t("login.error.googleNotConfigured", "Google authentication is not configured."));
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username || !password) {
      toast.error(t("login.error.missing", "Enter your username or email and password."));
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      const me = await fetchMe();
      if (!me) throw new Error(t("login.error.loadUser", "Failed to load current user."));
      if (adminHost && !(me.is_admin || me.is_redactor)) {
        await logout();
        throw new Error(t("login.error.noAdminAccess", "You do not have access to the admin portal."));
      }
      navigate(resolvePostLoginPath(adminHost, me), { replace: true });
      toast.success(t("login.success", "Signed in successfully."));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("login.error.failed", "Login failed.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex flex-col">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_80%_0%,hsl(var(--accent)/0.12),transparent_30%)]" />
      <Navbar />

      {/* ── Desktop: two-column layout ── */}
      <div className="hidden md:grid flex-1 container mx-auto min-h-screen items-center gap-12 px-6 py-12 md:grid-cols-2">
        {/* Left hero panel */}
        <section>
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5">
              {adminHost ? <Shield className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
              <span className="font-ui text-xs text-muted-foreground">
                {adminHost ? t("login.portal", "Editorial Management Portal") : t("login.welcome", "Welcome to Readus")}
              </span>
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-foreground md:text-5xl">
              {adminHost
                ? t("login.adminTitle", "Accurate Content Moderation")
                : t("login.userTitle", "Continue Your Literary Journey")}
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-muted-foreground">
              {adminHost
                ? t("login.adminSubtitle", "Sign in with a redactor or admin account to review writer applications and submitted works.")
                : t("login.userSubtitle", "Sign in to browse works, interact with authors, and manage your reading activity.")}
            </p>
          </div>
        </section>

        {/* Login form (desktop) */}
        <section className="mx-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <LoginForm
            adminHost={adminHost}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            loading={loading}
            googleClientId={googleClientId}
            handleSubmit={handleSubmit}
            handleGoogleLogin={handleGoogleLogin}
            t={t}
          />
        </section>
      </div>

      {/* ── Mobile: full-screen centered card ── */}
      <div className="flex md:hidden flex-1 flex-col items-center justify-center px-5 py-10 pb-28 min-h-screen">
        {/* App logo + tagline */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-warm"
            style={{ background: "var(--hero-gradient)" }}
          >
            {adminHost ? (
              <Shield className="h-7 w-7 text-white" />
            ) : (
              <BookOpen className="h-7 w-7 text-white" />
            )}
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {adminHost ? "Readus Admin" : "Readus"}
          </p>
          <p className="font-ui text-sm text-muted-foreground text-center max-w-[220px]">
            {adminHost
              ? t("login.portal", "Editorial Management Portal")
              : t("login.welcome", "Welcome back. Continue your journey.")}
          </p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/90 p-6 shadow-card backdrop-blur-sm">
          <LoginForm
            adminHost={adminHost}
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            loading={loading}
            googleClientId={googleClientId}
            handleSubmit={handleSubmit}
            handleGoogleLogin={handleGoogleLogin}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};

/* ── Shared login form component ── */
interface LoginFormProps {
  adminHost: boolean;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean | ((prev: boolean) => boolean)) => void;
  loading: boolean;
  googleClientId: string;
  handleSubmit: (e: FormEvent) => void;
  handleGoogleLogin: () => void;
  t: (key: string, fallback: string) => string;
}

const LoginForm = ({
  adminHost, username, setUsername, password, setPassword,
  showPassword, setShowPassword, loading, googleClientId,
  handleSubmit, handleGoogleLogin, t,
}: LoginFormProps) => (
  <>
    <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
      {adminHost ? t("login.adminHeading", "Admin Login") : t("login.heading", "Sign In")}
    </h2>
    <p className="mt-1 font-ui text-sm text-muted-foreground">
      {adminHost ? t("login.adminNote", "Restricted to redactor/admin roles.") : t("login.note", "Enter your details below to continue.")}
    </p>

    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="login-username" className="font-ui text-sm font-medium">
          {t("login.username", "Username or Email")}
        </Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-14 pl-10 font-ui text-base rounded-xl"
            placeholder={t("login.usernamePlaceholder", "your.name or email@example.com")}
            autoComplete="username"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="font-ui text-sm font-medium">
            {t("login.password", "Password")}
          </Label>
          {!adminHost && (
            <Link to="/forgot-password" className="font-ui text-xs text-primary underline-offset-4 hover:underline">
              {t("login.forgotPassword", "Forgot password?")}
            </Link>
          )}
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 pl-10 pr-11 font-ui text-base rounded-xl"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            style={{ touchAction: "manipulation" } as React.CSSProperties}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-14 gap-2 font-ui text-base font-semibold rounded-xl"
        disabled={loading}
        style={{ touchAction: "manipulation" } as React.CSSProperties}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            {t("login.signingIn", "Signing in…")}
          </span>
        ) : t("login.signIn", "Sign In")}
      </Button>
    </form>

    {!adminHost && (
      <>
        <div className="relative my-5">
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
          className="w-full h-14 gap-2 font-ui text-sm rounded-xl"
          onClick={handleGoogleLogin}
          disabled={loading || !googleClientId}
          style={{ touchAction: "manipulation" } as React.CSSProperties}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("login.googleContinue", "Continue with Google")}
        </Button>

        <div className="mt-5 flex items-center justify-center gap-1 font-ui text-sm text-muted-foreground">
          <span>{t("login.noAccount", "Don't have an account?")}</span>
          <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("login.createAccount", "Create one")}
          </Link>
        </div>
      </>
    )}
  </>
);

export default LoginPage;
