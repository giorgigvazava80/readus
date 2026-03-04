import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Feather, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SubmitPage = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File must be under 20MB");
        return;
      }
      setFileName(file.name);
      toast.success(`"${file.name}" uploaded successfully`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !synopsis || (!content && !fileName)) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md text-center"
        >
          <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
          <h1 className="mt-6 font-display text-3xl font-bold text-foreground">
            Submission Received
          </h1>
          <p className="mt-3 font-body text-muted-foreground">
            Thank you for submitting <strong>"{title}"</strong>. Our editorial team will
            review your work and get back to you within two weeks.
          </p>
          <Button className="mt-8" onClick={() => setSubmitted(false)}>
            Submit Another Work
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <Feather className="h-7 w-7 text-primary" />
            <h1 className="font-display text-3xl font-bold text-foreground">
              Submit Your Work
            </h1>
          </div>
          <p className="mt-2 font-ui text-sm text-muted-foreground">
            Upload a PDF or paste your text below. All submissions are reviewed by our editorial team.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-ui">Title *</Label>
              <Input
                id="title"
                placeholder="The title of your work"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-ui"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="font-ui">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="font-ui">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novel">Novel</SelectItem>
                  <SelectItem value="story">Short Story</SelectItem>
                  <SelectItem value="poem">Poetry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Synopsis */}
            <div className="space-y-2">
              <Label htmlFor="synopsis" className="font-ui">Synopsis *</Label>
              <Textarea
                id="synopsis"
                placeholder="A brief description of your work (max 500 characters)"
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                maxLength={500}
                rows={3}
                className="font-ui"
              />
              <p className="text-xs text-muted-foreground font-ui">{synopsis.length}/500</p>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="font-ui">Upload PDF</Label>
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors hover:border-primary/50 hover:bg-muted/50">
                <Upload className="h-8 w-8 text-muted-foreground" />
                {fileName ? (
                  <div className="flex items-center gap-2 text-sm text-foreground font-ui">
                    <FileText className="h-4 w-4 text-primary" />
                    {fileName}
                  </div>
                ) : (
                  <>
                    <p className="font-ui text-sm text-muted-foreground">
                      Click to upload or drag & drop
                    </p>
                    <p className="font-ui text-xs text-muted-foreground">PDF up to 20MB</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 font-ui text-muted-foreground">
                  Or paste your text
                </span>
              </div>
            </div>

            {/* Text Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="font-ui">Manuscript Text</Label>
              <Textarea
                id="content"
                placeholder="Paste your novel, story, or poem here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="font-body leading-relaxed"
              />
            </div>

            <Button type="submit" size="lg" className="w-full gap-2">
              <Feather className="h-4 w-4" />
              Submit for Review
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default SubmitPage;
