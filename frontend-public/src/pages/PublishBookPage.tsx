import { useI18n } from "@/i18n";
﻿import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookPlus } from "lucide-react";
import { toast } from "sonner";

import { createBook } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";

const PublishBookPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [foreword, setForeword] = useState("");
  const [afterword, setAfterword] = useState("");
  const [numberingStyle, setNumberingStyle] = useState<"arabic" | "roman" | "separator">("separator");
  const [sourceType, setSourceType] = useState<"manual" | "upload">("manual");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("Book title is required.");
      return;
    }

    if (sourceType === "upload" && !uploadFile) {
      toast.error("Choose a file when source type is upload.");
      return;
    }

    setSaving(true);
    try {
      const created = await createBook({
        title: title.trim(),
        description,
        foreword,
        afterword,
        numbering_style: numberingStyle,
        source_type: sourceType,
        upload_file: uploadFile,
      });

      toast.success(`Book \"${created.title}\" submitted for review.`);
      navigate("/my-works", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to publish book.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-7 shadow-card">
        <div className="flex items-center gap-2">
          <BookPlus className="h-5 w-5 text-primary" />
          <h1 className="font-display text-4xl font-semibold text-foreground">{t("work.book")}ს გამოქვეყნება</h1>
        </div>
        <p className="mt-2 font-body text-base text-muted-foreground">
          Create a new book submission. Status and moderation updates are managed by the existing content review API.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-ui">{t("work.title")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="font-ui" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-ui">{t("work.desc")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="font-ui"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-ui">თავების ნუმერაციის სტილი</Label>
              <Select value={numberingStyle} onValueChange={(value) => setNumberingStyle(value as "arabic" | "roman" | "separator")}>
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="separator">{t("editor.sep")}</SelectItem>
                  <SelectItem value="arabic">{t("editor.arabic")}</SelectItem>
                  <SelectItem value="roman">{t("editor.roman")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-ui">{t("work.sourceType")}</Label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as "manual" | "upload")}>
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">ხელით</SelectItem>
                  <SelectItem value="upload">{t("work.fileUpload")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceType === "upload" ? (
            <div className="space-y-2">
              <Label htmlFor="uploadFile" className="font-ui">{t("work.fileUpload")}</Label>
              <Input
                id="uploadFile"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="foreword" className="font-ui">{t("work.foreword")}</Label>
            <Textarea
              id="foreword"
              value={foreword}
              onChange={(e) => setForeword(e.target.value)}
              rows={4}
              className="font-body"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="afterword" className="font-ui">{t("work.afterword")}</Label>
            <Textarea
              id="afterword"
              value={afterword}
              onChange={(e) => setAfterword(e.target.value)}
              rows={4}
              className="font-body"
            />
          </div>

          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? "Publishing..." : "წიგნის გამოქვეყნება"}
          </Button>
        </form>
      </section>
    </div>
  );
};

export default PublishBookPage;




