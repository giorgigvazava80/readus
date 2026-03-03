import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { useI18n } from "@/i18n";
import { fetchMe, login, loginWithGoogleCode, logout } from "@/lib/api";
import { consumeGoogleOAuthState, createGoogleOAuthState } from "@/lib/oauth";
import { isAdminAppHost } from "@/lib/runtime";

const LoginPage = () => {
  const navigate = useNavigate();
  const adminHost = isAdminAppHost();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      toast.error(`Google login failed: ${oauthError}`);
      navigate(adminHost ? "/admin/login" : "/login", { replace: true });
      return;
    }

    if (!code) {
      return;
    }

    const expectedState = consumeGoogleOAuthState();
    const returnedState = params.get("state") || "";
    if (!expectedState || expectedState !== returnedState) {
      toast.error("Google login failed: invalid OAuth state.");
      navigate(adminHost ? "/admin/login" : "/login", { replace: true });
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        await loginWithGoogleCode(code, googleRedirectUri);
        const me = await fetchMe();
        if (!me) {
          throw new Error(t("login.error.loadUser", "მიმდინარე მომხმარებლის ჩატვირთვა ვერ მოხერხდა."));
        }

        if (adminHost && !(me.is_admin || me.is_redactor)) {
          await logout();
          throw new Error(t("login.error.noAdminAccess", "ადმინ პორტალზე წვდომა არ გაქვს."));
        }

        navigate(adminHost ? "/admin" : "/dashboard", { replace: true });
        toast.success("Google-ით წარმატებით შეხვედი.");
      } catch (error) {
        const message = error instanceof Error ? error.message : t("login.error.failed", "შესვლა ვერ მოხერხდა.");
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
      toast.error("Google ავტორიზაცია კონფიგურირებული არ არის.");
      return;
    }
    const state = createGoogleOAuthState();

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
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
      toast.error(t("login.error.missing", "შეიყვანე მომხმარებლის სახელი ან ელფოსტა და პაროლი."));
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      const me = await fetchMe();
      if (!me) {
        throw new Error(t("login.error.loadUser", "მიმდინარე მომხმარებლის ჩატვირთვა ვერ მოხერხდა."));
      }

      if (adminHost && !(me.is_admin || me.is_redactor)) {
        await logout();
        throw new Error(t("login.error.noAdminAccess", "ადმინ პორტალზე წვდომა არ გაქვს."));
      }

      navigate(adminHost ? "/admin" : "/dashboard");
      toast.success(t("login.success", "შესვლა წარმატებულია."));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("login.error.failed", "შესვლა ვერ მოხერხდა.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_80%_0%,hsl(var(--accent)/0.12),transparent_30%)]" />
      <Navbar />

      <div className="container relative mx-auto grid min-h-[calc(100vh-4rem)] items-center gap-12 px-6 py-12 md:grid-cols-2">
        <section className="hidden md:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5">
              {adminHost ? <Shield className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
              <span className="font-ui text-xs text-muted-foreground">
                {adminHost ? t("login.portal", "Editorial Management Portal") : t("login.welcome", "Welcome to read us")}
              </span>
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-foreground md:text-5xl">
              {adminHost ? t("login.adminTitle", "კონტენტის ზუსტი მოდერაცია") : t("login.userTitle", "გააგრძელე შენი ლიტერატურული გზა")}
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-muted-foreground">
              {adminHost
                ? t("login.adminSubtitle", "შედი რედაქტორის ან ადმინის ანგარიშით ავტორის განაცხადებისა და ნაშრომების განსახილველად.")
                : t("login.userSubtitle", "შედი, რომ დაათვალიერო ნაშრომები, იურთიერთო ავტორებთან და მართო შენი სამუშაო პროცესი.")}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            {adminHost ? t("login.adminHeading", "Admin Login") : t("login.heading", "Login")}
          </h2>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {adminHost ? t("login.adminNote", "Restricted to redactor/admin roles.") : t("login.note", "Sign in to your account.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-ui">{t("login.username", "მომხმარებლის სახელი ან ელფოსტა")}</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-ui">{t("login.password", "Password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-ui"
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? t("login.signingIn", "Signing in...") : t("login.signIn", "Sign In")}
            </Button>
          </form>

          {!adminHost ? (
            <div className="mt-5 flex items-center justify-between text-sm font-ui">
              <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/register">
                {t("login.createAccount", "Create account")}
              </Link>
              <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/forgot-password">
                {t("login.forgotPassword", "პაროლი დაგავიწყდა")}
              </Link>
            </div>
          ) : null}

          {!adminHost ? (
            <div className="mt-4 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={loading || !googleClientId}
              >
                გაგრძელება Google-ით
              </Button>
              {!googleClientId ? (
                <p className="text-center text-xs font-ui text-muted-foreground">
                  Google ავტორიზაცია ჯერ არ არის გამართული (`VITE_GOOGLE_CLIENT_ID` არ არის მითითებული).
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default LoginPage;





