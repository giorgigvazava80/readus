import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchMe, login, logout } from "@/lib/api";
import { isAdminAppHost } from "@/lib/runtime";

const LoginPage = () => {
  const navigate = useNavigate();
  const adminHost = isAdminAppHost();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!username || !password) {
      toast.error("Enter username and password.");
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      const me = await fetchMe();
      if (!me) {
        throw new Error("Failed to load current user.");
      }

      if (adminHost && !(me.is_admin || me.is_redactor)) {
        await logout();
        throw new Error("You do not have admin portal access.");
      }

      navigate(adminHost ? "/admin" : "/dashboard");
      toast.success("Logged in.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_80%_0%,hsl(var(--accent)/0.12),transparent_30%)]" />
      <div className="container relative mx-auto grid min-h-screen items-center gap-12 px-6 py-12 md:grid-cols-2">
        <section className="hidden md:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5">
              {adminHost ? <Shield className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
              <span className="font-ui text-xs text-muted-foreground">
                {adminHost ? "Editorial Management Portal" : "Welcome to Quill & Page"}
              </span>
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-foreground md:text-5xl">
              {adminHost ? "Moderate Content with Precision" : "Continue Your Literary Journey"}
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-muted-foreground">
              {adminHost
                ? "Sign in with a redactor or admin account to review writer applications and submissions."
                : "Sign in to browse stories, engage with authors, and manage your writing workflow."}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            {adminHost ? "Admin Login" : "Login"}
          </h2>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            {adminHost ? "Restricted to redactor/admin roles." : "Sign in to your account."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-ui">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-ui">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-ui"
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {!adminHost ? (
            <div className="mt-5 flex items-center justify-between text-sm font-ui">
              <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/register">
                Create account
              </Link>
              <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/forgot-password">
                Forgot password
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default LoginPage;