import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Feather, CheckCircle2, Sparkles } from "lucide-react";
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

const STEPS = ["Details", "Manuscript", "Review"];

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

  const currentStep = !title || !category || !synopsis ? 0 : !content && !fileName ? 1 : 2;

  if (submitted) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-md text-center"
        >
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-warm"
            style={{ background: "var(--hero-gradient)" }}
          >
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Submission Received!
          </h1>
          <p className="mt-3 font-body text-base leading-relaxed text-muted-foreground">
            Thank you for submitting <strong>"{title}"</strong>. Our editorial team will review your work and get back to you within two weeks.
          </p>
          <div
            className="mt-6 rounded-xl p-4 text-sm font-ui text-muted-foreground"
            style={{ background: "hsl(36 70% 50% / 0.08)" }}
          >
            <Sparkles className="inline h-4 w-4 text-primary mr-1.5" />
            You'll receive an email notification once your review is complete.
          </div>
          <Button
            className="mt-8 w-full gap-2 font-ui"
            onClick={() => {
              setSubmitted(false);
              setTitle(""); setCategory(""); setSynopsis(""); setContent(""); setFileName("");
            }}
          >
            <Feather className="h-4 w-4" />
            Submit Another Work
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mx-auto max-w-2xl">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "var(--hero-gradient)" }}
              >
                <Feather className="h-5 w-5 text-white" />
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Submit Your Work
              </h1>
            </div>
            <p className="font-ui text-sm text-muted-foreground ml-[52px]">
              Upload a PDF or paste your text below. All submissions are reviewed by our editorial team.
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8 flex items-center gap-0">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold font-ui transition-all duration-300 ${i < currentStep
                        ? "text-white shadow-sm"
                        : i === currentStep
                          ? "text-white shadow-warm scale-110"
                          : "bg-muted text-muted-foreground"
                      }`}
                    style={i <= currentStep ? { background: "var(--hero-gradient)" } : undefined}
                  >
                    {i < currentStep ? "✓" : i + 1}
                  </div>
                  <span
                    className={`mt-1 font-ui text-xs font-medium ${i <= currentStep ? "text-primary" : "text-muted-foreground"
                      }`}
                  >
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 h-px bg-border mb-5 transition-all duration-500"
                    style={i < currentStep ? { background: "var(--hero-gradient)" } : undefined}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form card */}
          <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: "var(--hero-gradient)" }} />
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="font-ui font-medium text-sm">
                  Title <span className="text-primary">*</span>
                </Label>
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
                <Label className="font-ui font-medium text-sm">
                  Category <span className="text-primary">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="font-ui">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novel">📖 Novel</SelectItem>
                    <SelectItem value="story">📄 Short Story</SelectItem>
                    <SelectItem value="poem">🪶 Poetry</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Synopsis */}
              <div className="space-y-2">
                <Label htmlFor="synopsis" className="font-ui font-medium text-sm">
                  Synopsis <span className="text-primary">*</span>
                </Label>
                <Textarea
                  id="synopsis"
                  placeholder="A brief description of your work (max 500 characters)"
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="font-ui resize-none"
                />
                <div className="flex justify-end">
                  <span
                    className={`font-ui text-xs ${synopsis.length > 450 ? "text-primary font-medium" : "text-muted-foreground"
                      }`}
                  >
                    {synopsis.length}/500
                  </span>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="font-ui font-medium text-sm">Upload PDF</Label>
                <label
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 ${fileName
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                >
                  {fileName ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
                        style={{ background: "hsl(36 70% 50% / 0.1)" }}
                      >
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-ui text-sm font-medium text-foreground">
                        {fileName}
                      </span>
                      <span className="font-ui text-xs text-primary">Click to replace</span>
                    </div>
                  ) : (
                    <>
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ background: "hsl(36 70% 50% / 0.08)" }}
                      >
                        <Upload className="h-6 w-6 text-primary/60" />
                      </div>
                      <div className="text-center">
                        <p className="font-ui text-sm font-medium text-foreground">
                          Click to upload or drag & drop
                        </p>
                        <p className="font-ui text-xs text-muted-foreground mt-1">PDF up to 20MB</p>
                      </div>
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
                  <span className="bg-card px-3 font-ui text-muted-foreground">
                    Or paste your text
                  </span>
                </div>
              </div>

              {/* Text Content */}
              <div className="space-y-2">
                <Label htmlFor="content" className="font-ui font-medium text-sm">
                  Manuscript Text
                </Label>
                <Textarea
                  id="content"
                  placeholder="Paste your novel, story, or poem here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="font-body leading-relaxed"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full gap-2 font-ui font-semibold shadow-warm hover:shadow-lg transition-all duration-200"
              >
                <Feather className="h-4 w-4" />
                Submit for Review
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SubmitPage;
