import { useI18n } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readingFontSizeOptions, type ReadingFontSize } from "@/lib/fontSize";
import { cn } from "@/lib/utils";

interface ReadingFontSizeControlProps {
  value: ReadingFontSize;
  onChange: (value: ReadingFontSize) => void;
  className?: string;
}

const ReadingFontSizeControl = ({ value, onChange, className }: ReadingFontSizeControlProps) => {
  const { t } = useI18n();

  return (
    <section className={cn("mb-6 rounded-xl border border-border/70 bg-card/60 p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-ui text-xs text-muted-foreground">{t("reader.fontSize.label", "Text size")}:</span>
        <Select value={value} onValueChange={(next) => onChange(next as ReadingFontSize)}>
          <SelectTrigger className="h-8 w-[190px] bg-background font-ui text-xs">
            <SelectValue placeholder={t("reader.fontSize.placeholder", "Select size")} />
          </SelectTrigger>
          <SelectContent>
            {readingFontSizeOptions.map((option) => (
              <SelectItem key={option} value={option} className="font-ui text-xs">
                {t(`reader.fontSize.${option}`, option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
};

export default ReadingFontSizeControl;
