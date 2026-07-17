import { h, render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Palette,
  Settings,
} from "lucide-preact";
import mermaid from "mermaid";

const sampleMermaid =
  "flowchart TD\n  A[Markdown file] --> B{Mermaid blocks?}\n  B -->|Files tab| C[Select diagram]\n  B -->|Write tab| D[Live edit]\n  C --> E[Preview]\n  D --> E\n";
const colorSchemes = [
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
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [writeSource, setWriteSource] = useState(sampleMermaid);
  const [colorScheme, setColorScheme] = useState(colorSchemes[0].id);
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

    async function loadInitialFile() {
      try {
        const response = await fetch("/api/initial-file");
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled || !data.file?.text) return;

        loadMarkdownText(data.file.name, data.file.text);
      } catch {
        // The Vite dev server does not provide this endpoint.
      }
    }

    loadInitialFile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFileChange(event) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    const text = await file.text();
    loadMarkdownText(file.name, text);
  }

  function loadMarkdownText(name, text) {
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
          onSelect: setColorScheme,
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
          onFileChange: handleFileChange,
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

function SettingsMenu({ schemes, selectedScheme, onSelect }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("main");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  function chooseScheme(scheme) {
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

function SettingsPopover(
  { view, setView, schemes, selectedScheme, chooseScheme },
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

function TabButton({ active, onClick, children }) {
  return h("button", {
    className: active ? "tab is-active" : "tab",
    type: "button",
    onClick,
  }, children);
}

function FilesTab(
  { blocks, fileName, selectedBlockId, onFileChange, onSelectBlock },
) {
  const fileInputRef = useRef(null);

  async function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];

    if (!file) return;

    await onFileChange({ currentTarget: { files: [file] } });
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
          className: "file-picker",
          onClick: () => fileInputRef.current?.click(),
        },
        "Choose Markdown",
      ),
      h("input", {
        ref: fileInputRef,
        className: "file-input",
        type: "file",
        accept: ".md,.markdown,text/markdown,text/plain",
        onChange: onFileChange,
      }),
    ),
    h("p", { className: "drop-hint" }, "or drop a Markdown file here"),
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

function WriteTab({ source, onChange }) {
  return h(
    "section",
    { className: "tab-panel editor-panel" },
    h("textarea", {
      className: "mermaid-editor",
      spellCheck: "false",
      value: source,
      onInput: (event) => onChange(event.currentTarget.value),
      "aria-label": "Mermaid source",
    }),
  );
}

function PreviewToolbar({ title }) {
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

function MermaidPreview({ source, scheme }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const previewId = useMemo(() => "diagram-" + crypto.randomUUID(), [source]);
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const panStateRef = useRef({ dragging: false, x: 0, y: 0, left: 0, top: 0 });
  const pointerMapRef = useRef(new Map());
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
          setError(renderError?.message ?? String(renderError));
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [previewId, scheme, source]);

  function updateTransform(next) {
    setTransform((current) => ({
      scale: clamp(next.scale ?? current.scale, 0.25, 4),
      x: next.x ?? current.x,
      y: next.y ?? current.y,
    }));
  }

  function handleWheel(event) {
    if (!svg) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const scale = transform.scale + direction * 0.12;
    updateTransform({ scale });
  }

  function handlePointerDown(event) {
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

  function handlePointerMove(event) {
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

  function stopDragging(event) {
    if (event?.pointerId !== undefined) {
      pointerMapRef.current.delete(event.pointerId);
    }

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

function extractMermaidBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  let fenceStartLine = 0;
  let isMermaidFence = false;
  let buffer = [];

  lines.forEach((line, lineIndex) => {
    const opening = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);

    if (!inFence && opening) {
      const marker = opening[2];
      const info = opening[3].trim().toLowerCase();
      inFence = true;
      fenceChar = marker[0];
      fenceLength = marker.length;
      fenceStartLine = lineIndex + 1;
      isMermaidFence = info.split(/\s+/)[0] === "mermaid";
      buffer = [];
      return;
    }

    if (inFence) {
      const closingPattern = new RegExp(
        "^\\s*" + escapeRegExp(fenceChar) + "{" + fenceLength + ",}\\s*$",
      );

      if (closingPattern.test(line)) {
        if (isMermaidFence) {
          const index = blocks.length;
          blocks.push({
            id: "mermaid-" + (index + 1),
            title: "Diagram " + (index + 1) + " · line " + fenceStartLine,
            index,
            startLine: fenceStartLine,
            source: buffer.join("\n").trim(),
          });
        }

        inFence = false;
        fenceChar = "";
        fenceLength = 0;
        isMermaidFence = false;
        buffer = [];
        return;
      }

      if (isMermaidFence) buffer.push(line);
    }
  });

  return blocks;
}

function firstMeaningfulLine(source) {
  return source.split(/\r?\n/).find((line) => line.trim())?.trim() ??
    "Empty block";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pointerDistance(pointerMap) {
  const pointers = Array.from(pointerMap.values());
  if (pointers.length < 2) return 0;

  const [first, second] = pointers;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function mermaidThemeVariables(schemeId) {
  const variables = {
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

render(h(App), document.getElementById("app"));
