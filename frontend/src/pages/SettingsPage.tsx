import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/hooks/useSession";
import { changePassword, updateProfile } from "@/lib/api";
import type { MeUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { me } = useSession();

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword1, setNewPassword1] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setUsername(me?.username || "");
    setFirstName(me?.first_name || "");
    setLastName(me?.last_name || "");
  }, [me]);

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();

    setSavingProfile(true);
    try {
      await updateProfile({ username, first_name: firstName, last_name: lastName });
      queryClient.setQueryData<MeUser | null>(["me"], (previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          username,
          first_name: firstName,
          last_name: lastName,
        };
      });
      toast.success("Profile updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile update failed.";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();

    if (!oldPassword || !newPassword1 || !newPassword2) {
      toast.error("Fill all password fields.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({
        old_password: oldPassword,
        new_password1: newPassword1,
        new_password2: newPassword2,
      });
      setOldPassword("");
      setNewPassword1("");
      setNewPassword2("");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Password changed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Password change failed.";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="container mx-auto grid gap-8 px-6 py-10 lg:grid-cols-2">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <UserRoundCog className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl font-semibold text-foreground">Profile Settings</h1>
        </div>

        <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="font-ui">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-ui">First name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-ui">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="font-ui" />
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-3xl font-semibold text-foreground">Change Password</h2>
        </div>
        {me?.forced_password_change ? (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 font-ui text-sm text-red-700">
            Password change is required for this account.
          </p>
        ) : null}

        <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword" className="font-ui">Current password</Label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="font-ui"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword1" className="font-ui">New password</Label>
            <Input
              id="newPassword1"
              type="password"
              value={newPassword1}
              onChange={(e) => setNewPassword1(e.target.value)}
              className="font-ui"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword2" className="font-ui">Repeat new password</Label>
            <Input
              id="newPassword2"
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className="font-ui"
            />
          </div>
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </section>
    </div>
  );
};

export default SettingsPage;
