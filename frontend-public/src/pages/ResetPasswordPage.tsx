import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset } from "@/lib/api";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const uidFromQuery = useMemo(() => searchParams.get("uid") || "", [searchParams]);
  const tokenFromQuery = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [uid, setUid] = useState(uidFromQuery);
  const [token, setტოკენი] = useState(tokenFromQuery);
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!uid || !token || !password1 || !password2) {
      toast.error("Fill all fields.");
      return;
    }

    if (password1 !== password2) {
      toast.error("პაროლები არ ემთხვევა.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset({ uid, token, new_password1: password1, new_password2: password2 });
      toast.success("Password reset successful.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Password reset failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_5%,hsl(var(--primary)/0.14),transparent_34%),radial-gradient(circle_at_85%_8%,hsl(var(--accent)/0.1),transparent_30%)]" />
      <div className="container relative mx-auto flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="font-display text-3xl font-semibold text-foreground">პაროლის განახლება</h1>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">გამოიყენე აღდგენის ბმულიდან მიღებული მნიშვნელობები.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uid" className="font-ui">მომხმარებლის ID</Label>
              <Input id="uid" value={uid} onChange={(e) => setUid(e.target.value)} className="font-ui" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token" className="font-ui">ტოკენი</Label>
              <Input id="token" value={token} onChange={(e) => setტოკენი(e.target.value)} className="font-ui" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password1" className="font-ui">ახალი პაროლი</Label>
              <Input
                id="password1"
                type="password"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                className="font-ui"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password2" className="font-ui">ახალი პაროლის გამეორება</Label>
              <Input
                id="password2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="font-ui"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "პაროლის განახლება"}
            </Button>
          </form>

          <p className="mt-5 text-center font-ui text-sm text-muted-foreground">
            Return to{" "}
            <Link className="underline-offset-4 hover:underline" to="/login">
              login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;


