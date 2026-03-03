import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type BlockType = "p" | "h1" | "h2" | "h3" | "blockquote";
type CommandStateKey =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull";

function createDefaultCommandStates(): Record<CommandStateKey, boolean> {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
  };
}

function normalizeBlockType(rawValue: string): BlockType {
  const normalized = rawValue.toLowerCase().replace(/[<>]/g, "");
  if (normalized === "h1" || normalized === "h2" || normalized === "h3" || normalized === "blockquote") {
    return normalized;
  }
  return "p";
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
  minHeightClass = "min-h-[180px] sm:min-h-[300px]",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [commandStates, setCommandStates] = useState<Record<CommandStateKey, boolean>>(createDefaultCommandStates);
  const [blockType, setBlockType] = useState<BlockType>("p");

  const syncToolbarState = useCallback(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }

    const selection = window.getSelection();
    const isSelectionInsideEditor = Boolean(
      selection &&
      selection.rangeCount > 0 &&
      selection.anchorNode &&
      selection.focusNode &&
      node.contains(selection.anchorNode) &&
      node.contains(selection.focusNode),
    );

    if (!isSelectionInsideEditor && document.activeElement !== node) {
      setCommandStates(createDefaultCommandStates());
      setBlockType("p");
      return;
    }

    const queryState = (command: CommandStateKey) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };

    let nextBlockType: BlockType = "p";
    try {
      nextBlockType = normalizeBlockType(String(document.queryCommandValue("formatBlock") || "p"));
    } catch {
      nextBlockType = "p";
    }

    setCommandStates({
      bold: queryState("bold"),
      italic: queryState("italic"),
      underline: queryState("underline"),
      strikeThrough: queryState("strikeThrough"),
      insertUnorderedList: queryState("insertUnorderedList"),
      insertOrderedList: queryState("insertOrderedList"),
      justifyLeft: queryState("justifyLeft"),
      justifyCenter: queryState("justifyCenter"),
      justifyRight: queryState("justifyRight"),
      justifyFull: queryState("justifyFull"),
    });
    setBlockType(nextBlockType);
  }, []);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }

    if (document.activeElement === node) {
      syncToolbarState();
      return;
    }

    const normalized = normalizeHtml(value);
    if (normalizeHtml(node.innerHTML) !== normalized) {
      node.innerHTML = normalized;
    }
    syncToolbarState();
  }, [syncToolbarState, value]);

  useEffect(() => {
    const handleSelectionChange = () => {
      syncToolbarState();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [syncToolbarState]);

  const pushChange = useCallback(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }
    onChange(node.innerHTML);
    syncToolbarState();
  }, [onChange, syncToolbarState]);

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
      syncToolbarState();
    },
    [disabled, pushChange, syncToolbarState],
  );

  const toolbarButtons = useMemo(
    () => [
      { label: "Bold", icon: Bold, command: "bold", stateKey: "bold" as const },
      { label: "Italic", icon: Italic, command: "italic", stateKey: "italic" as const },
      { label: "Underline", icon: Underline, command: "underline", stateKey: "underline" as const },
      { label: "Strike", icon: Strikethrough, command: "strikeThrough", stateKey: "strikeThrough" as const },
      { label: "Quote", icon: Quote, command: "formatBlock", value: "blockquote", stateKey: "blockquote" as const },
      { label: "Rule", icon: Minus, command: "insertHorizontalRule" },
      { label: "Bullets", icon: List, command: "insertUnorderedList", stateKey: "insertUnorderedList" as const },
      { label: "Numbers", icon: ListOrdered, command: "insertOrderedList", stateKey: "insertOrderedList" as const },
      { label: "Left", icon: AlignLeft, command: "justifyLeft", stateKey: "justifyLeft" as const },
      { label: "Center", icon: AlignCenter, command: "justifyCenter", stateKey: "justifyCenter" as const },
      { label: "Right", icon: AlignRight, command: "justifyRight", stateKey: "justifyRight" as const },
      { label: "Justify", icon: AlignJustify, command: "justifyFull", stateKey: "justifyFull" as const },
      { label: "Indent", icon: Indent, command: "indent" },
      { label: "Outdent", icon: Outdent, command: "outdent" },
    ],
    [],
  );

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card/70 flex flex-col min-w-0 w-full", className)}>
      <div className="border-b border-border/70 p-1.5 sm:p-2.5 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <select
            value={blockType}
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

          <div className="mx-1 h-6 w-px bg-border/70" />

          {toolbarButtons.map((item) => {
            const isActive =
              item.stateKey === "blockquote"
                ? blockType === "blockquote"
                : item.stateKey
                  ? commandStates[item.stateKey]
                  : false;

            return (
              <Button
                key={item.label}
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 border transition-colors",
                  isActive
                    ? "border-primary/45 bg-primary/15 text-primary hover:bg-primary/20"
                    : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/70 hover:text-foreground",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (item.stateKey === "blockquote") {
                    runCommand("formatBlock", blockType === "blockquote" ? "p" : "blockquote");
                    return;
                  }
                  runCommand(item.command, item.value);
                }}
                disabled={disabled}
                title={item.label}
                aria-pressed={isActive}
              >
                <item.icon className="h-4 w-4" />
              </Button>
            );
          })}

          <div className="mx-1 h-6 w-px bg-border/70" />

          <label className="flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-ui">
            <Pilcrow className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Text</span>
            <Input
              type="color"
              className="h-6 w-8 border-none p-0"
              onChange={(event) => runCommand("foreColor", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className="flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-ui">
            <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Highlight</span>
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
            className="h-8 w-8 shrink-0 border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/70 hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
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
            className="h-8 w-8 shrink-0 border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/70 hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
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
            className="h-8 w-8 shrink-0 border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/70 hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
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
      </div>

      <div
        ref={editorRef}
        className={cn(
          "editor-content prose-literary w-full overflow-auto rounded-b-xl bg-background/70 p-5 outline-none",
          minHeightClass,
          disabled ? "cursor-not-allowed resize-none opacity-70" : "cursor-text resize-y",
        )}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={pushChange}
        onFocus={syncToolbarState}
        onKeyUp={syncToolbarState}
        onMouseUp={syncToolbarState}
      />

      <div className="border-t border-border/70 px-3 py-2 font-ui text-xs text-muted-foreground">
        Shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+U
      </div>
    </div >
  );
}
