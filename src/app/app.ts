import { h, render } from "preact";
import type {
  ComponentChildren,
  TargetedDragEvent,
  TargetedEvent,
  TargetedInputEvent,
  TargetedPointerEvent,
  TargetedWheelEvent,
} from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  extractMermaidBlocks,
  type MermaidBlock,
} from "../domain/mermaidBlocks.ts";
import type { FileSummary } from "../domain/settings.ts";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Palette,
  Settings,
  Trash2,
} from "lucide-preact";
import mermaid from "mermaid";

const sampleMermaid =
  "flowchart TD\n  A[Markdown file] --> B{Mermaid blocks?}\n  B -->|Files tab| C[Select diagram]\n  B -->|Write tab| D[Live edit]\n  C --> E[Preview]\n  D --> E\n";
type ColorSchemeId = "graphite" | "citrus" | "lagoon" | "rose";
type SettingsView = "main" | "color";

interface ColorScheme {
  id: ColorSchemeId;
  name: string;
  swatch: string;
  mermaidTheme: "default" | "base";
}

interface Point {
  x: number;
  y: number;
}

interface Transform extends Point {
  scale: number;
}

const colorSchemes: readonly ColorScheme[] = [
  {
    id: "graphite",
    name: "Graphite",
    swatch: "#1f6feb",
    mermaidTheme: "default",
  },
  { id: "citrus", name: "Citrus", swatch: "#f2a900", mermaidTheme: "base" },
  { id: "lagoon", name: "Lagoon", swatch: "#008b8b", mermaidTheme: "base" },
  { id: "rose", name: "Rose", swatch: "#d14d72", mermaidTheme: "base" },
];

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "default",
});

function App() {
  const [activeTab, setActiveTab] = useState("write");
  const [fileName, setFileName] = useState("");
  const [blocks, setBlocks] = useState<MermaidBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [writeSource, setWriteSource] = useState(sampleMermaid);
  const [colorScheme, setColorScheme] = useState(colorSchemes[0].id);
  const [recentFiles, setRecentFiles] = useState<FileSummary[]>([]);
  const [fileError, setFileError] = useState("");
  const [isChoosingFile, setIsChoosingFile] = useState(false);
  const [desktopApiAvailable, setDesktopApiAvailable] = useState(false);
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ??
    null;
  const selectedScheme =
    colorSchemes.find((scheme) => scheme.id === colorScheme) ?? colorSchemes[0];
  const previewSource = activeTab === "files"
    ? selectedBlock?.source ?? ""
    : writeSource;
  const previewTitle = activeTab === "files"
    ? selectedBlock?.title ?? "No diagram selected"
    : "Write preview";

  useEffect(() => {
    let cancelled = false;

    async function loadStartupState() {
      try {
        const settingsResponse = await fetch("/api/settings");
        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          if (!cancelled) setDesktopApiAvailable(true);
          if (!cancelled && isKnownColorScheme(data.settings?.colorScheme)) {
            setColorScheme(data.settings.colorScheme);
          }
          if (!cancelled && Array.isArray(data.settings?.summary)) {
            setRecentFiles(data.settings.summary);
          }
        }
      } catch {
        // The Vite dev server does not provide desktop settings.
      }

      try {
        const fileResponse = await fetch("/api/initial-file");
        if (!fileResponse.ok) return;

        const data = await fileResponse.json();
        if (cancelled || !data.file?.text) return;

        loadMarkdownText(data.file.name, data.file.text);
      } catch {
        // The Vite dev server does not provide the initial file endpoint.
      }
    }

    loadStartupState();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleColorSchemeSelect(schemeId: ColorSchemeId) {
    setColorScheme(schemeId);
    void saveSettings({ colorScheme: schemeId });
  }

  async function handleFile(file: File) {
    const text = await file.text();
    loadMarkdownText(file.name, text);
  }

  async function handleFileChange(event: TargetedEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    await handleFile(file);
  }

  async function chooseFile() {
    setFileError("");
    setIsChoosingFile(true);

    try {
      const response = await fetch("/api/choose-markdown", { method: "POST" });
      const data = await response.json();

      if (data.cancelled) return;
      if (!response.ok || !data.file?.text) {
        throw new Error(data.error || "Could not open the selected file.");
      }

      loadMarkdownText(data.file.name, data.file.text);
      setRecentFiles((current) => markFileAsRecent(current, data.file.path));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChoosingFile(false);
    }
  }

  async function openRecentFile(path: string) {
    setFileError("");

    try {
      const response = await fetch(
        "/api/read-markdown?path=" + encodeURIComponent(path),
      );
      const data = await response.json();

      if (!response.ok || !data.file?.text) {
        throw new Error(data.error || "Could not open this file.");
      }

      loadMarkdownText(data.file.name, data.file.text);
      setRecentFiles((current) => markFileAsRecent(current, data.file.path));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteRecentFile(path: string) {
    setFileError("");

    try {
      const response = await fetch("/api/recent-files", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove this file.");
      }

      setRecentFiles(data.settings?.summary ?? []);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  }

  function loadMarkdownText(name: string, text: string) {
    const extracted = extractMermaidBlocks(text);
    setFileName(name);
    setBlocks(extracted);
    setSelectedBlockId(extracted[0]?.id ?? "");
    setActiveTab("files");
  }

  return h(
    "main",
    { className: "shell theme-" + selectedScheme.id },
    h(
      "aside",
      { className: "side-panel" },
      h(
        "header",
        { className: "brand" },
        h(
          "div",
          { className: "brand-copy" },
          h("h1", null, "Mermaid Reviewer"),
          h("p", null, "Review Markdown diagrams and live Mermaid drafts."),
        ),
        h(SettingsMenu, {
          schemes: colorSchemes,
          selectedScheme,
          onSelect: handleColorSchemeSelect,
        }),
      ),
      h(
        "nav",
        { className: "tabs", "aria-label": "Editor mode" },
        h(TabButton, {
          active: activeTab === "files",
          onClick: () => setActiveTab("files"),
        }, "Files"),
        h(TabButton, {
          active: activeTab === "write",
          onClick: () => setActiveTab("write"),
        }, "Write"),
      ),
      activeTab === "files"
        ? h(FilesTab, {
          blocks,
          fileName,
          selectedBlockId,
          recentFiles,
          fileError,
          isChoosingFile,
          desktopApiAvailable,
          onChooseFile: chooseFile,
          onFile: handleFile,
          onFileChange: handleFileChange,
          onOpenRecentFile: openRecentFile,
          onDeleteRecentFile: deleteRecentFile,
          onSelectBlock: setSelectedBlockId,
        })
        : h(WriteTab, {
          source: writeSource,
          onChange: setWriteSource,
        }),
    ),
    h(
      "section",
      { className: "preview-panel" },
      h(PreviewToolbar, { title: previewTitle }),
      h(MermaidPreview, { source: previewSource, scheme: selectedScheme }),
    ),
  );
}

async function saveSettings(settings: { colorScheme: ColorSchemeId }) {
  try {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch {
    // Settings persistence is only available in the desktop app.
  }
}

function isKnownColorScheme(value: unknown): value is ColorSchemeId {
  return colorSchemes.some((scheme) => scheme.id === value);
}

function markFileAsRecent(
  files: FileSummary[],
  path: string,
): FileSummary[] {
  return [
    { path, lastUsedAt: new Date().toISOString() },
    ...files.filter((file) => file.path !== path),
  ];
}

interface SettingsMenuProps {
  schemes: readonly ColorScheme[];
  selectedScheme: ColorScheme;
  onSelect: (schemeId: ColorSchemeId) => void;
}

function SettingsMenu(
  { schemes, selectedScheme, onSelect }: SettingsMenuProps,
) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SettingsView>("main");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        !(event.target instanceof Node) ||
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  function chooseScheme(scheme: ColorScheme) {
    onSelect(scheme.id);
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (next) setView("main");
      return next;
    });
  }

  return h(
    "div",
    { className: "settings-menu", ref: menuRef },
    h(
      "button",
      {
        type: "button",
        className: "icon-button",
        onClick: toggleOpen,
        "aria-label": "Settings",
        "aria-expanded": open ? "true" : "false",
      },
      h(Settings, { size: 18, "aria-hidden": "true" }),
    ),
    open
      ? h(SettingsPopover, {
        view,
        setView,
        schemes,
        selectedScheme,
        chooseScheme,
      })
      : null,
  );
}

interface SettingsPopoverProps {
  view: SettingsView;
  setView: (view: SettingsView) => void;
  schemes: readonly ColorScheme[];
  selectedScheme: ColorScheme;
  chooseScheme: (scheme: ColorScheme) => void;
}

function SettingsPopover(
  { view, setView, schemes, selectedScheme, chooseScheme }:
    SettingsPopoverProps,
) {
  if (view === "color") {
    return h(
      "div",
      { className: "settings-popover", role: "menu" },
      h(
        "div",
        { className: "settings-header" },
        h(
          "button",
          {
            type: "button",
            className: "settings-back",
            onClick: () => setView("main"),
            "aria-label": "Back to settings",
          },
          h(ArrowLeft, { size: 16, "aria-hidden": "true" }),
        ),
        h("span", null, "Color schema"),
      ),
      schemes.map((scheme) =>
        h(
          "button",
          {
            key: scheme.id,
            type: "button",
            className: scheme.id === selectedScheme.id
              ? "settings-option is-selected"
              : "settings-option",
            onClick: () => chooseScheme(scheme),
            role: "menuitemradio",
            "aria-checked": scheme.id === selectedScheme.id ? "true" : "false",
          },
          h("span", {
            className: "scheme-swatch",
            style: { background: scheme.swatch },
          }),
          h("span", null, scheme.name),
          scheme.id === selectedScheme.id
            ? h(Check, { size: 16, "aria-hidden": "true" })
            : h("span", { className: "scheme-check-placeholder" }),
        )
      ),
    );
  }

  return h(
    "div",
    { className: "settings-popover", role: "menu" },
    h("div", { className: "settings-heading" }, "Settings"),
    h(
      "button",
      {
        type: "button",
        className: "settings-option settings-option-wide",
        onClick: () => setView("color"),
        role: "menuitem",
      },
      h(Palette, { size: 16, "aria-hidden": "true" }),
      h(
        "span",
        { className: "settings-option-copy" },
        h("span", null, "Color schema"),
        h("small", null, selectedScheme.name),
      ),
      h(ChevronRight, { size: 16, "aria-hidden": "true" }),
    ),
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children?: ComponentChildren;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return h("button", {
    className: active ? "tab is-active" : "tab",
    type: "button",
    onClick,
  }, children);
}

interface FilesTabProps {
  blocks: MermaidBlock[];
  fileName: string;
  selectedBlockId: string;
  recentFiles: FileSummary[];
  fileError: string;
  isChoosingFile: boolean;
  desktopApiAvailable: boolean;
  onChooseFile: () => void | Promise<void>;
  onFile: (file: File) => void | Promise<void>;
  onFileChange: (
    event: TargetedEvent<HTMLInputElement>,
  ) => void | Promise<void>;
  onOpenRecentFile: (path: string) => void | Promise<void>;
  onDeleteRecentFile: (path: string) => void | Promise<void>;
  onSelectBlock: (blockId: string) => void;
}

function FilesTab(
  {
    blocks,
    fileName,
    selectedBlockId,
    recentFiles,
    fileError,
    isChoosingFile,
    desktopApiAvailable,
    onChooseFile,
    onFile,
    onFileChange,
    onOpenRecentFile,
    onDeleteRecentFile,
    onSelectBlock,
  }: FilesTabProps,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDrop(event: TargetedDragEvent<HTMLElement>) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];

    if (!file) return;

    await onFile(file);
  }

  return h(
    "section",
    {
      className: "tab-panel",
      onDragOver: (event) => event.preventDefault(),
      onDrop: handleDrop,
    },
    h(
      "div",
      { className: "file-picker-row" },
      h(
        "button",
        {
          type: "button",
          className: "browse-button",
          onClick: desktopApiAvailable
            ? onChooseFile
            : () => fileInputRef.current?.click(),
          disabled: isChoosingFile,
        },
        isChoosingFile ? "Choosing…" : "Choose File",
      ),
      h("input", {
        ref: fileInputRef,
        className: "browse-input",
        type: "file",
        accept: ".md,.markdown,text/markdown,text/plain",
        onChange: onFileChange,
        "aria-label": "Browse Markdown",
      }),
    ),
    h(
      "p",
      { className: fileError ? "path-message is-error" : "path-message" },
      fileError || "Choose a Markdown file, or drop one here.",
    ),
    recentFiles.length > 0
      ? h(
        "div",
        { className: "recent-file-list", role: "list" },
        recentFiles.map((file) =>
          h(
            "div",
            { className: "recent-file-item", role: "listitem", key: file.path },
            h(
              "button",
              {
                type: "button",
                className: "recent-file-open",
                onClick: () => onOpenRecentFile(file.path),
                title: file.path,
              },
              h(FileText, { size: 16, "aria-hidden": "true" }),
              h(
                "span",
                { className: "recent-file-copy" },
                h("span", null, fileNameFromPath(file.path)),
                h("small", null, file.path),
              ),
            ),
            h(
              "button",
              {
                type: "button",
                className: "recent-file-delete",
                onClick: () => onDeleteRecentFile(file.path),
                "aria-label": "Remove " + fileNameFromPath(file.path),
                title: "Remove from recent files",
              },
              h(Trash2, { size: 15, "aria-hidden": "true" }),
            ),
          )
        ),
      )
      : null,
    h(
      "div",
      { className: "file-meta" },
      fileName ? h("span", { title: fileName }, fileName) : "No file selected",
    ),
    blocks.length > 0
      ? h(
        "div",
        { className: "block-list", role: "list" },
        blocks.map((block) =>
          h(
            "button",
            {
              key: block.id,
              type: "button",
              className: block.id === selectedBlockId
                ? "block-item is-selected"
                : "block-item",
              onClick: () => onSelectBlock(block.id),
            },
            h("span", null, block.title),
            h("small", null, firstMeaningfulLine(block.source)),
          )
        ),
      )
      : h(
        "p",
        { className: "empty-state" },
        fileName
          ? "No Mermaid blocks found."
          : "Select a Markdown file to extract Mermaid blocks.",
      ),
  );
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

interface WriteTabProps {
  source: string;
  onChange: (source: string) => void;
}

function WriteTab({ source, onChange }: WriteTabProps) {
  return h(
    "section",
    { className: "tab-panel editor-panel" },
    h("textarea", {
      className: "mermaid-editor",
      spellCheck: "false",
      value: source,
      onInput: (event: TargetedInputEvent<HTMLTextAreaElement>) =>
        onChange(event.currentTarget.value),
      "aria-label": "Mermaid source",
    }),
  );
}

function PreviewToolbar({ title }: { title: string }) {
  return h(
    "header",
    { className: "preview-toolbar" },
    h(
      "div",
      null,
      h("h2", null, title),
      h("p", null, "Wheel or pinch to zoom. Drag to pan."),
    ),
  );
}

interface MermaidPreviewProps {
  source: string;
  scheme: ColorScheme;
}

function MermaidPreview({ source, scheme }: MermaidPreviewProps) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const previewId = useMemo(() => "diagram-" + crypto.randomUUID(), [source]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef({ dragging: false, x: 0, y: 0, left: 0, top: 0 });
  const pointerMapRef = useRef(new Map<number, Point>());
  const pinchStateRef = useRef({ distance: 0, scale: 1 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      const trimmed = source.trim();
      setError("");
      setSvg("");
      setTransform({ scale: 1, x: 0, y: 0 });

      if (!trimmed) return;

      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: scheme.mermaidTheme,
          themeVariables: mermaidThemeVariables(scheme.id),
        });
        const result = await mermaid.render(previewId, trimmed);
        if (!cancelled) setSvg(result.svg);
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : String(renderError),
          );
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [previewId, scheme, source]);

  function updateTransform(next: Partial<Transform>) {
    setTransform((current) => ({
      scale: clamp(next.scale ?? current.scale, 0.25, 4),
      x: next.x ?? current.x,
      y: next.y ?? current.y,
    }));
  }

  function handleWheel(event: TargetedWheelEvent<HTMLDivElement>) {
    if (!svg) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const scale = transform.scale + direction * 0.12;
    updateTransform({ scale });
  }

  function handlePointerDown(event: TargetedPointerEvent<HTMLDivElement>) {
    if (!svg) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerMapRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointerMapRef.current.size === 2) {
      pinchStateRef.current = {
        distance: pointerDistance(pointerMapRef.current),
        scale: transform.scale,
      };
      panStateRef.current.dragging = false;
      return;
    }

    panStateRef.current = {
      dragging: true,
      x: event.clientX,
      y: event.clientY,
      left: transform.x,
      top: transform.y,
    };
  }

  function handlePointerMove(event: TargetedPointerEvent<HTMLDivElement>) {
    if (pointerMapRef.current.has(event.pointerId)) {
      pointerMapRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (pointerMapRef.current.size >= 2) {
      const start = pinchStateRef.current;
      const nextDistance = pointerDistance(pointerMapRef.current);

      if (start.distance > 0 && nextDistance > 0) {
        updateTransform({
          scale: start.scale * (nextDistance / start.distance),
        });
      }

      return;
    }

    const pan = panStateRef.current;
    if (!pan.dragging) return;
    updateTransform({
      x: pan.left + event.clientX - pan.x,
      y: pan.top + event.clientY - pan.y,
    });
  }

  function stopDragging(event: TargetedPointerEvent<HTMLDivElement>) {
    pointerMapRef.current.delete(event.pointerId);

    panStateRef.current.dragging = false;

    if (pointerMapRef.current.size === 1) {
      const remaining = Array.from(pointerMapRef.current.values())[0];
      panStateRef.current = {
        dragging: true,
        x: remaining.x,
        y: remaining.y,
        left: transform.x,
        top: transform.y,
      };
    }
  }

  function resetView() {
    setTransform({ scale: 1, x: 0, y: 0 });
  }

  const style = {
    transform: "translate(" + transform.x + "px, " + transform.y +
      "px) scale(" + transform.scale + ")",
  };

  return h(
    "div",
    { className: "preview-wrap" },
    h(
      "div",
      { className: "preview-actions" },
      h("button", {
        type: "button",
        onClick: () => updateTransform({ scale: transform.scale - 0.2 }),
      }, "−"),
      h("output", null, Math.round(transform.scale * 100) + "%"),
      h("button", {
        type: "button",
        onClick: () => updateTransform({ scale: transform.scale + 0.2 }),
      }, "+"),
      h("button", { type: "button", onClick: resetView }, "Reset"),
    ),
    h(
      "div",
      {
        ref: viewportRef,
        className: "diagram-viewport",
        onWheel: handleWheel,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: stopDragging,
        onPointerCancel: stopDragging,
      },
      !source.trim()
        ? h("p", { className: "empty-state" }, "No Mermaid source selected.")
        : error
        ? h("pre", { className: "render-error" }, error)
        : svg
        ? h("div", {
          ref: contentRef,
          className: "diagram-content",
          style,
          dangerouslySetInnerHTML: { __html: svg },
        })
        : h("p", { className: "empty-state" }, "Rendering..."),
    ),
  );
}

function firstMeaningfulLine(source: string): string {
  return source.split(/\r?\n/).find((line) => line.trim())?.trim() ??
    "Empty block";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pointerDistance(pointerMap: Map<number, Point>): number {
  const pointers = Array.from(pointerMap.values());
  if (pointers.length < 2) return 0;

  const [first, second] = pointers;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function mermaidThemeVariables(schemeId: ColorSchemeId) {
  const variables: Record<ColorSchemeId, Record<string, string>> = {
    graphite: {
      primaryColor: "#eef5ff",
      primaryBorderColor: "#1f6feb",
      lineColor: "#596272",
      textColor: "#17181c",
    },
    citrus: {
      primaryColor: "#fff4d2",
      primaryBorderColor: "#c78200",
      lineColor: "#80642c",
      textColor: "#242016",
    },
    lagoon: {
      primaryColor: "#ddf7f3",
      primaryBorderColor: "#008b8b",
      lineColor: "#3f6f69",
      textColor: "#14221f",
    },
    rose: {
      primaryColor: "#ffe9ef",
      primaryBorderColor: "#d14d72",
      lineColor: "#8a5b68",
      textColor: "#2a171d",
    },
  };

  return variables[schemeId] ?? variables.graphite;
}

const root = document.getElementById("app");
if (!root) throw new Error("App root element was not found.");
render(h(App, null), root);
