import { FormEvent, useState } from "react";
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
          <h1 className="font-display text-4xl font-semibold text-foreground">Publish Book</h1>
        </div>
        <p className="mt-2 font-body text-base text-muted-foreground">
          Create a new book submission. Status and moderation updates are managed by the existing content review API.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-ui">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="font-ui" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-ui">Description</Label>
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
              <Label className="font-ui">Chapter numbering style</Label>
              <Select value={numberingStyle} onValueChange={(value) => setNumberingStyle(value as "arabic" | "roman" | "separator")}>
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="separator">Separator (***)</SelectItem>
                  <SelectItem value="arabic">Arabic (1,2,3)</SelectItem>
                  <SelectItem value="roman">Roman (I,II,III)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-ui">Source type</Label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as "manual" | "upload")}>
                <SelectTrigger className="font-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="upload">Upload file</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceType === "upload" ? (
            <div className="space-y-2">
              <Label htmlFor="uploadFile" className="font-ui">Upload file</Label>
              <Input
                id="uploadFile"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="foreword" className="font-ui">Foreword</Label>
            <Textarea
              id="foreword"
              value={foreword}
              onChange={(e) => setForeword(e.target.value)}
              rows={4}
              className="font-body"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="afterword" className="font-ui">Afterword</Label>
            <Textarea
              id="afterword"
              value={afterword}
              onChange={(e) => setAfterword(e.target.value)}
              rows={4}
              className="font-body"
            />
          </div>

          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? "Publishing..." : "Publish Book"}
          </Button>
        </form>
      </section>
    </div>
  );
};

export default PublishBookPage;
