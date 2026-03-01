import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email) {
      toast.error("Enter your email.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      toast.success("Password reset email sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset request failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,hsl(var(--primary)/0.14),transparent_34%),radial-gradient(circle_at_82%_5%,hsl(var(--accent)/0.1),transparent_28%)]" />
      <div className="container relative mx-auto flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h1 className="font-display text-3xl font-semibold text-foreground">Forgot Password</h1>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send reset instructions.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-ui">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="font-ui" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <p className="mt-5 text-center font-ui text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link className="underline-offset-4 hover:underline" to="/login">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;