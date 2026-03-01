interface SaveStateBadgeProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  lastError: string | null;
}

export default function SaveStateBadge({ isSaving, hasUnsavedChanges, lastSavedAt, lastError }: SaveStateBadgeProps) {
  if (lastError) {
    return <span className="font-ui text-xs text-red-700">Save error: {lastError}</span>;
  }

  if (isSaving) {
    return <span className="font-ui text-xs text-muted-foreground">Saving...</span>;
  }

  if (hasUnsavedChanges) {
    return <span className="font-ui text-xs text-amber-700">Unsaved changes</span>;
  }

  if (lastSavedAt) {
    return <span className="font-ui text-xs text-emerald-700">Saved at {lastSavedAt.toLocaleTimeString()}</span>;
  }

  return <span className="font-ui text-xs text-muted-foreground">No changes yet</span>;
}
