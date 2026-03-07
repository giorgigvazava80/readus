import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRedactor, deleteRedactor, fetchRedactors, updateRedactor } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AdminRedactorsPage = () => {
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
      const message = error instanceof Error ? error.message : "რედაქტორის შექმნა ვერ მოხერხდა.";
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
      const message = error instanceof Error ? error.message : "რედაქტორის განახლება ვერ მოხერხდა.";
      toast.error(message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRedactor(id);
      await reload();
      toast.success("რედაქტორი წაიშალა.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "რედაქტორის წაშლა ვერ მოხერხდა.";
      toast.error(message);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-7 shadow-card"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ShieldPlus className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">რედაქტორების მართვა</h1>
        </div>

        <form onSubmit={handleCreate} className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 flex flex-col justify-end">
            <Label className="font-ui text-muted-foreground ml-1">ელფოსტა (სავალდებულო)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <Label className="font-ui text-muted-foreground ml-1">მომხმარებლის სახელი</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <Label className="font-ui text-muted-foreground ml-1">პაროლი</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <Label className="font-ui text-muted-foreground ml-1">სახელი</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <Label className="font-ui text-muted-foreground ml-1">გვარი</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="font-ui h-11 bg-background/50 border-border/60 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 rounded-xl transition-all"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isCreating}
              className="w-full sm:w-auto h-11 px-8 rounded-xl shadow-warm hover:shadow-lg transition-all"
            >
              <ShieldPlus className="h-4 w-4 mr-2" />
              {isCreating ? "ინახება..." : "შექმნა/დაწინაურება"}
            </Button>
          </div>
        </form>
      </motion.section>

      <section className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-7 shadow-card min-h-[400px]">
        <h2 className="font-display text-2xl font-bold text-foreground tracking-tight border-b border-border/40 pb-4 mb-6">მიმდინარე რედაქტორები</h2>

        {redactorsQuery.isLoading ? (
          <p className="mt-3 font-ui text-sm text-muted-foreground animate-pulse">რედაქტორები იტვირთება...</p>
        ) : null}

        {redactorsQuery.isError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-5 font-ui text-sm text-red-700 font-medium"
          >
            {redactorsErrorMessage}
          </motion.div>
        ) : null}

        {redactors.length === 0 && !redactorsQuery.isLoading && !redactorsQuery.isError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[200px] flex-col items-center justify-center mt-4 rounded-xl border border-dashed border-border/80 bg-background/40 p-5 font-ui text-sm text-muted-foreground"
          >
            <UserMinus className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p>რედაქტორები ჯერ არ არის.</p>
          </motion.div>
        ) : null}

        <AnimatePresence mode="wait">
          {redactors.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="mt-4 space-y-4"
            >
              {redactors.map((redactor) => (
                <motion.div
                  key={redactor.id}
                  variants={itemVariants}
                  className="rounded-xl border border-border/70 bg-background/50 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
                    <div>
                      <p className="font-display text-xl font-bold text-foreground">
                        {redactor.username} <span className="font-ui text-base font-normal text-muted-foreground">({redactor.email})</span>
                      </p>
                      <p className="mt-1 font-ui text-sm text-muted-foreground">{redactor.first_name} {redactor.last_name}</p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(redactor.id)}
                      className="gap-1.5 rounded-xl h-10 hover:bg-destructive shadow-sm"
                    >
                      <UserMinus className="h-4 w-4" />
                      წაშლა
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      ["is_active", "აქტიური"],
                      ["can_review_writer_applications", "განაცხადების განხილვა"],
                      ["can_review_content", "კონტენტის განხილვა"],
                      ["can_manage_content", "კონტენტის მართვა"],
                      ["can_manage_redactors", "რედაქტორების მართვა"],
                    ].map(([field, label]) => (
                      <label
                        key={field}
                        className={`
                          flex flex-col gap-2 rounded-xl border p-3 cursor-pointer transition-colors
                          ${redactor.permissions[field as keyof typeof redactor.permissions]
                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                            : 'border-border/60 bg-background/40 hover:border-primary/30'}
                        `}
                      >
                        <div className="flex items-center gap-2 font-ui text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={Boolean(redactor.permissions[field as keyof typeof redactor.permissions])}
                            onChange={(event) => handleToggle(redactor.id, field, event.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary overflow-hidden"
                          />
                          <span className={`${redactor.permissions[field as keyof typeof redactor.permissions] ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {label}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default AdminRedactorsPage;
