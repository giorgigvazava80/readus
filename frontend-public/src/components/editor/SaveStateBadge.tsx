import { useI18n } from "@/i18n";

interface SaveStateBadgeProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  lastError: string | null;
}

export default function SaveStateBadge({ isSaving, hasUnsavedChanges, lastSavedAt, lastError }: SaveStateBadgeProps) {
  const { t } = useI18n();

  if (lastError) {
    return <span className="font-ui text-xs text-red-700">{t("editor.saveError", "Save error").replace("{error}", lastError)}</span>;
  }

  if (isSaving) {
    return <span className="font-ui text-xs text-muted-foreground">{t("editor.saving")}</span>;
  }

  if (hasUnsavedChanges) {
    return <span className="font-ui text-xs text-amber-700">{t("editor.unsaved")}</span>;
  }

  if (lastSavedAt) {
    return (
      <span className="font-ui text-xs text-emerald-700">
        {t("editor.savedAt", "Saved at {time}").replace("{time}", lastSavedAt.toLocaleTimeString())}
      </span>
    );
  }

  return <span className="font-ui text-xs text-muted-foreground">{t("editor.noChanges")}</span>;
}
