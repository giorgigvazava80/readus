import { FormEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Camera, Lock, UserRoundCog, X } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/hooks/useSession";
import { changePassword, resolveMediaUrl, updateProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function normalizeDate(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateLabel(value: Date): string {
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ageFromBirthDate(value: Date): number {
  const today = normalizeDate(new Date());
  let age = today.getFullYear() - value.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > value.getMonth()
    || (today.getMonth() === value.getMonth() && today.getDate() >= value.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

function parseBirthDateFromApi(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return undefined;
  }

  return normalizeDate(parsed);
}

function formatBirthDateForApi(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { me } = useSession();
  const [birthDatePickerOpen, setBirthDatePickerOpen] = useState(false);
  const today = normalizeDate(new Date());

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword1, setNewPassword1] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setUsername(me?.username || "");
    setFirstName(me?.first_name || "");
    setLastName(me?.last_name || "");
    setBirthDate(parseBirthDateFromApi(me?.birth_date));
    setProfilePhotoFile(null);
    setRemoveProfilePhoto(false);
    setProfilePhotoPreview((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return resolveMediaUrl(me?.profile_photo) || null;
    });
    if (profilePhotoInputRef.current) {
      profilePhotoInputRef.current.value = "";
    }
  }, [me]);

  useEffect(() => {
    return () => {
      if (profilePhotoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePhotoPreview);
      }
    };
  }, [profilePhotoPreview]);

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();

    let birthDatePayload: string | null = null;
    if (birthDate) {
      const parsedAge = ageFromBirthDate(birthDate);
      if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        toast.error("Birth date must produce an age between 1 and 120.");
        return;
      }
      birthDatePayload = formatBirthDateForApi(birthDate);
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDatePayload,
        profile_photo: profilePhotoFile,
        remove_profile_photo: removeProfilePhoto,
      });
      setProfilePhotoFile(null);
      setRemoveProfilePhoto(false);
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = "";
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update profile.";
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
      toast.success("Password updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not change password.";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const profileInitial = (firstName || username || me?.email || "?").charAt(0).toUpperCase();
  const hasPhotoPreview = Boolean(profilePhotoPreview);
  const selectedAge = birthDate ? ageFromBirthDate(birthDate) : null;
  const minDate = new Date(today.getFullYear() - 120, 0, 1);
  const birthDateInputValue = birthDate ? formatBirthDateForApi(birthDate) : "";
  const minBirthDateValue = formatBirthDateForApi(minDate);
  const maxBirthDateValue = formatBirthDateForApi(today);

  return (
    <div className="container mx-auto grid gap-8 px-6 py-10 lg:grid-cols-2">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <UserRoundCog className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl font-semibold text-foreground">Profile Settings</h1>
        </div>

        <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="font-ui">Profile Photo</Label>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/70 bg-background/60 p-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-border/70 bg-muted/50">
                {hasPhotoPreview ? (
                  <img src={profilePhotoPreview || ""} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-xl text-muted-foreground">
                    {profileInitial}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setProfilePhotoFile(file);
                    setRemoveProfilePhoto(false);
                    setProfilePhotoPreview((current) => {
                      if (current?.startsWith("blob:")) {
                        URL.revokeObjectURL(current);
                      }
                      return file ? URL.createObjectURL(file) : resolveMediaUrl(me?.profile_photo) || null;
                    });
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => profilePhotoInputRef.current?.click()}>
                    <Camera className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                  {hasPhotoPreview ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (profilePhotoInputRef.current) {
                          profilePhotoInputRef.current.value = "";
                        }
                        setProfilePhotoFile(null);
                        setRemoveProfilePhoto(true);
                        setProfilePhotoPreview((current) => {
                          if (current?.startsWith("blob:")) {
                            URL.revokeObjectURL(current);
                          }
                          return null;
                        });
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {profilePhotoFile ? <p className="font-ui text-xs text-muted-foreground">{profilePhotoFile.name}</p> : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="font-ui">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-ui">First Name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-ui">Last Name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-2">
            <Label className="font-ui">Birth Date</Label>
            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
              <div className="md:hidden">
                <Input
                  type="date"
                  value={birthDateInputValue}
                  min={minBirthDateValue}
                  max={maxBirthDateValue}
                  onChange={(event) => setBirthDate(parseBirthDateFromApi(event.target.value))}
                  className="font-ui"
                />
              </div>

              <div className="hidden md:block">
                <Popover open={birthDatePickerOpen} onOpenChange={setBirthDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full items-center justify-between gap-3 rounded-lg border-border/80 bg-background px-3 py-3 font-ui"
                    >
                      <span className="flex items-center gap-2 text-left">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {birthDate ? formatDateLabel(birthDate) : "Pick your birth date"}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {selectedAge != null ? `${selectedAge} years` : "Optional"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(92vw,22rem)] p-0">
                    <Calendar
                      mode="single"
                      selected={birthDate}
                      onSelect={(value) => {
                        setBirthDate(value ? normalizeDate(value) : undefined);
                        setBirthDatePickerOpen(false);
                      }}
                      disabled={(date) => date > today || date < minDate}
                      captionLayout="dropdown-buttons"
                      fromYear={today.getFullYear() - 120}
                      toYear={today.getFullYear()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-ui text-xs text-muted-foreground">
                  Stored as your birth date and used to calculate age.
                </p>
                {birthDate ? (
                  <button
                    type="button"
                    className="font-ui text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={() => setBirthDate(undefined)}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
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
            <Label htmlFor="oldPassword" className="font-ui">Current Password</Label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="font-ui"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword1" className="font-ui">New Password</Label>
            <Input
              id="newPassword1"
              type="password"
              value={newPassword1}
              onChange={(e) => setNewPassword1(e.target.value)}
              className="font-ui"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword2" className="font-ui">Repeat New Password</Label>
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
