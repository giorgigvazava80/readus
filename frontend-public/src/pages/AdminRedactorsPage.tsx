import { useI18n } from "@/i18n";
﻿import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRedactor, deleteRedactor, fetchRedactors, updateRedactor } from "@/lib/api";

const AdminRedactorsPage = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const redactorsQuery = useQuery({
    queryKey: ["admin", "redactors"],
    queryFn: fetchRedactors,
  });
  const redactorsErrorMessage =
    redactorsQuery.error instanceof Error
      ? redactorsQuery.error.message
      : "რედაქტორების ჩატვირთვა ვერ მოხერხდა. გადაამოწმე წვდომები.";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const redactors = useMemo(() => redactorsQuery.data || [], [redactorsQuery.data]);

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "redactors"] });
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    if (!email) {
      toast.error("ელფოსტა სავალდებულოა.");
      return;
    }

    setIsCreating(true);
    try {
      await createRedactor({
        username: username || undefined,
        email,
        password: password || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        can_review_writer_applications: true,
        can_review_content: true,
        can_manage_content: false,
        can_manage_redactors: false,
        is_active: true,
      });
      setUsername("");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      await reload();
      toast.success("რედაქტორი წარმატებით შეიქმნა/განახლდა.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create redactor.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (id: number, field: string, value: boolean) => {
    try {
      await updateRedactor(id, { [field]: value });
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update redactor.";
      toast.error(message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRedactor(id);
      await reload();
      toast.success("რედაქტორი წაიშალა.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove redactor.";
      toast.error(message);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <ShieldPlus className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl font-semibold text-foreground">რედაქტორების მართვა</h1>
        </div>

        <form onSubmit={handleCreate} className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="font-ui">ელფოსტა (სავალდებულო)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="font-ui" />
          </div>
          <div className="space-y-1">
            <Label className="font-ui">მომხმარებლის სახელი (მხოლოდ ახალი მომხმარებელი)</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-1">
            <Label className="font-ui">პაროლი (მხოლოდ ახალი მომხმარებელი)</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="font-ui" />
          </div>
          <div className="space-y-1">
            <Label className="font-ui">სახელი</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="font-ui" />
          </div>
          <div className="space-y-1">
            <Label className="font-ui">გვარი</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="font-ui" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "ინახება..." : "შექმნა/დაწინაურება"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <h2 className="font-display text-2xl font-semibold text-foreground">მიმდინარე რედაქტორები</h2>
        {redactorsQuery.isLoading ? <p className="mt-3 font-ui text-sm text-muted-foreground">რედაქტორები იტვირთება...</p> : null}
        {redactorsQuery.isError ? (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-5 font-ui text-sm text-red-700">
            {redactorsErrorMessage}
          </div>
        ) : null}
        {redactors.length === 0 && !redactorsQuery.isLoading && !redactorsQuery.isError ? (
          <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/65 p-5 font-ui text-sm text-muted-foreground">
            რედაქტორები ჯერ არ არის.
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {redactors.map((redactor) => (
            <div key={redactor.id} className="rounded-xl border border-border/70 bg-background/70 p-4 font-ui text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold text-foreground">
                    {redactor.username} ({redactor.email})
                  </p>
                  <p className="text-muted-foreground">{redactor.first_name} {redactor.last_name}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(redactor.id)} className="gap-1.5">
                  <UserMinus className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["is_active", "Active"],
                  ["can_review_writer_applications", "განაცხადების განხილვა"],
                  ["can_review_content", t("admin.contentReview")],
                  ["can_manage_content", "კონტენტის მართვა"],
                  ["can_manage_redactors", "რედაქტორების მართვა"],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/70 p-2">
                    <input
                      type="checkbox"
                      checked={Boolean(redactor.permissions[field as keyof typeof redactor.permissions])}
                      onChange={(event) => handleToggle(redactor.id, field, event.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminRedactorsPage;


