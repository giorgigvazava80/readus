import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  ImagePlus,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Pilcrow,
  Quote,
  Strikethrough,
  Table,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeightClass?: string;
}

function normalizeHtml(value: string): string {
  return value.trim() ? value : "";
}

const FONT_OPTIONS = [
  { label: "Serif", value: "Georgia" },
  { label: "Sans", value: "Arial" },
  { label: "Mono", value: "Courier New" },
  { label: "Display", value: "Times New Roman" },
];

const SIZE_OPTIONS = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "XL", value: "5" },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  disabled = false,
  minHeightClass = "min-h-[300px]",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }

    if (document.activeElement === node) {
      return;
    }

    const normalized = normalizeHtml(value);
    if (normalizeHtml(node.innerHTML) !== normalized) {
      node.innerHTML = normalized;
    }
  }, [value]);

  const pushChange = useCallback(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }
    onChange(node.innerHTML);
  }, [onChange]);

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      if (disabled) {
        return;
      }
      const node = editorRef.current;
      if (!node) {
        return;
      }

      node.focus();
      document.execCommand(command, false, commandValue);
      pushChange();
    },
    [disabled, pushChange],
  );

  const toolbarButtons = useMemo(
    () => [
      { label: "Bold", icon: Bold, command: "bold" },
      { label: "Italic", icon: Italic, command: "italic" },
      { label: "Underline", icon: Underline, command: "underline" },
      { label: "Strike", icon: Strikethrough, command: "strikeThrough" },
      { label: "Quote", icon: Quote, command: "formatBlock", value: "blockquote" },
      { label: "Rule", icon: Minus, command: "insertHorizontalRule" },
      { label: "Bullets", icon: List, command: "insertUnorderedList" },
      { label: "Numbers", icon: ListOrdered, command: "insertOrderedList" },
      { label: "Left", icon: AlignLeft, command: "justifyLeft" },
      { label: "Center", icon: AlignCenter, command: "justifyCenter" },
      { label: "Right", icon: AlignRight, command: "justifyRight" },
      { label: "Justify", icon: AlignJustify, command: "justifyFull" },
      { label: "Indent", icon: Indent, command: "indent" },
      { label: "Outdent", icon: Outdent, command: "outdent" },
    ],
    [],
  );

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card/70", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
        <select
          defaultValue="p"
          className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs font-ui"
          onChange={(event) => runCommand("formatBlock", event.target.value)}
          disabled={disabled}
          aria-label="Paragraph style"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>

        <select
          defaultValue={FONT_OPTIONS[0].value}
          className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs font-ui"
          onChange={(event) => runCommand("fontName", event.target.value)}
          disabled={disabled}
          aria-label="Font family"
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          defaultValue={SIZE_OPTIONS[1].value}
          className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs font-ui"
          onChange={(event) => runCommand("fontSize", event.target.value)}
          disabled={disabled}
          aria-label="Font size"
        >
          {SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="h-6 w-px bg-border/70" />

        {toolbarButtons.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => runCommand(item.command, item.value)}
            disabled={disabled}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
          </Button>
        ))}

        <div className="h-6 w-px bg-border/70" />

        <label className="flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-ui">
          <Pilcrow className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Text</span>
          <Input
            type="color"
            className="h-6 w-8 border-none p-0"
            onChange={(event) => runCommand("foreColor", event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-ui">
          <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Mark</span>
          <Input
            type="color"
            className="h-6 w-8 border-none p-0"
            onChange={(event) => runCommand("hiliteColor", event.target.value)}
            disabled={disabled}
          />
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            const href = window.prompt("Enter link URL (include https://)", "https://");
            if (href) {
              runCommand("createLink", href);
            }
          }}
          disabled={disabled}
          title="Insert link"
        >
          <Link2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            const src = window.prompt("Image URL", "https://");
            if (src) {
              runCommand("insertImage", src);
            }
          }}
          disabled={disabled}
          title="Embed image"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            runCommand(
              "insertHTML",
              "<table><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table><p></p>",
            )
          }
          disabled={disabled}
          title="Insert table"
        >
          <Table className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={editorRef}
        className={cn(
          "editor-content prose-literary w-full rounded-b-xl bg-background/70 p-5 outline-none",
          minHeightClass,
          disabled ? "cursor-not-allowed opacity-70" : "cursor-text",
        )}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={pushChange}
      />

      <div className="border-t border-border/70 px-3 py-2 font-ui text-xs text-muted-foreground">
        Shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+U
      </div>
    </div>
  );
}
