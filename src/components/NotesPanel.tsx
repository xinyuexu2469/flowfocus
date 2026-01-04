import { useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, List } from "lucide-react";

const STORAGE_KEY = "flowfocus.notes.draft.v1";

type ExecCommand =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "removeFormat";

function safeExecCommand(command: ExecCommand) {
  try {
    // `execCommand` is deprecated but still widely supported for basic rich-text.
    if (typeof document !== "undefined" && typeof document.execCommand === "function") {
      document.execCommand(command, false);
    }
  } catch {
    // no-op
  }
}

export function NotesPanel() {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const initialHtml = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    // Initialize editor content once.
    if (!editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold">Notes</h3>
          <p className="text-sm text-muted-foreground">
            Capture lessons learned and helpful notes (saved locally in your browser)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Bold"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              safeExecCommand("bold");
            }}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Italic"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              safeExecCommand("italic");
            }}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              safeExecCommand("underline");
            }}
          >
            <Underline className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Bulleted list"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              safeExecCommand("insertUnorderedList");
            }}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="Clear formatting"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              safeExecCommand("removeFormat");
            }}
          >
            Clear formatting
          </Button>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        className="min-h-[60vh] w-full rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onInput={() => {
          const html = editorRef.current?.innerHTML ?? "";
          try {
            window.localStorage.setItem(STORAGE_KEY, html);
          } catch {
            // ignore
          }
        }}
      />

      <p className="mt-2 text-xs text-muted-foreground">
        Tip: Select text, then click a toolbar button (Ctrl/Cmd + B/I/U).
      </p>
    </Card>
  );
}
