export interface MermaidBlock {
  id: string;
  title: string;
  index: number;
  startLine: number;
  source: string;
}

export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  let fenceStartLine = 0;
  let isMermaidFence = false;
  let buffer: string[] = [];

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
            id: `mermaid-${index + 1}`,
            title: `Diagram ${index + 1} · line ${fenceStartLine}`,
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

      if (isMermaidFence) {
        buffer.push(line);
      }
    }
  });

  return blocks;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
