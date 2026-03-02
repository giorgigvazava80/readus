import { Button } from "@/components/ui/button";
import { readingFontSizeOptions, type ReadingFontSize } from "@/lib/fontSize";
import { cn } from "@/lib/utils";

interface ReadingFontSizeControlProps {
  value: ReadingFontSize;
  onChange: (value: ReadingFontSize) => void;
  className?: string;
}

const ReadingFontSizeControl = ({ value, onChange, className }: ReadingFontSizeControlProps) => (
  <section className={cn("mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/60 p-3", className)}>
    <span className="font-ui text-xs text-muted-foreground">ტექსტის ზომა:</span>
    {readingFontSizeOptions.map((option) => {
      const isActive = value === option.value;

      return (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={isActive ? "default" : "outline"}
          className={cn("h-8 px-3 font-ui text-xs", !isActive && "bg-background")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      );
    })}
  </section>
);

export default ReadingFontSizeControl;
