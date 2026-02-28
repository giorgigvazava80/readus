import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Feather } from "lucide-react";
import { toast } from "sonner";

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
import { register, resendVerification } from "@/lib/api";
import type { RegisteredRole } from "@/lib/types";

const RegisterPage = () => {
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
      toast.error("Fill all required fields.");
      return;
    }

    if (password !== password2) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({ username, email, firstName, lastName, password, password2, role });
      setRegisteredEmail(email);
      toast.success("Registration successful. Verify your email to activate account.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) {
      toast.error("Register first to resend verification.");
      return;
    }

    try {
      await resendVerification(registeredEmail);
      toast.success("Verification email resent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend verification.";
      toast.error(message);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_92%_10%,hsl(var(--accent)/0.1),transparent_32%)]" />
      <div className="container relative mx-auto grid min-h-screen items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/75 px-4 py-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="font-ui text-xs text-muted-foreground">Create your Quill &amp; Page account</span>
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-tight text-foreground">
              Reader First. Writer by Approval.
            </h1>
            <p className="mt-4 font-body text-lg leading-relaxed text-muted-foreground">
              Reader registration unlocks public reading, reviews, likes, and comments. If you choose writer, you will verify email and then complete the writer application before publication rights are granted.
            </p>
            <div className="mt-7 grid gap-3">
              <div className="rounded-xl border border-border/70 bg-card/75 p-4 shadow-card">
                <p className="font-display text-lg font-semibold text-foreground">Reader</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">Review, like, comment, and follow published works.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/75 p-4 shadow-card">
                <p className="font-display text-lg font-semibold text-foreground">Writer Track</p>
                <p className="mt-1 font-ui text-sm text-muted-foreground">Submit writing proof after verification and wait for editorial review.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card/85 p-7 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Feather className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-semibold text-foreground">Register</h2>
          </div>
          <p className="mt-1 font-ui text-sm text-muted-foreground">
            All accounts require email verification before access.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-ui">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="font-ui" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="font-ui">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="font-ui" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-ui">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-ui">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="font-ui" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-ui">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as RegisteredRole)}>
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reader">Reader</SelectItem>
                  <SelectItem value="writer">Writer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="password2" className="font-ui">Repeat password</Label>
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
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm font-ui">
            <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/login">
              Already have an account?
            </Link>
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={handleResend}
            >
              Resend verification
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;