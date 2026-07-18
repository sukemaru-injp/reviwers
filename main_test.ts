import { assertEquals } from "@std/assert";
import { extractMermaidBlocks } from "./src/domain/mermaidBlocks.ts";
import {
  normalizeSettings,
  recordRecentFile,
  removeRecentFile,
} from "./src/domain/settings.ts";

Deno.test("extracts multiple mermaid fenced blocks", () => {
  const blocks = extractMermaidBlocks(`# Spec

\`\`\`ts
console.log("skip");
\`\`\`

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

~~~MERMAID
sequenceDiagram
  Alice->>Bob: hello
~~~
`);

  assertEquals(blocks.length, 2);
  assertEquals(blocks[0].title, "Diagram 1 · line 7");
  assertEquals(blocks[0].source, "flowchart TD\n  A --> B");
  assertEquals(blocks[1].title, "Diagram 2 · line 12");
  assertEquals(blocks[1].source.includes("sequenceDiagram"), true);
});

Deno.test("ignores documents without mermaid fences", () => {
  assertEquals(
    extractMermaidBlocks("# No diagrams\n\n```js\nconst x = 1;\n```"),
    [],
  );
});

Deno.test("normalizes file summaries and removes invalid entries", () => {
  assertEquals(
    normalizeSettings({
      colorScheme: "lagoon",
      summary: [
        { path: "/docs/one.md", lastUsedAt: "2026-07-18T01:00:00.000Z" },
        { path: "/docs/one.md", lastUsedAt: "2026-07-17T01:00:00.000Z" },
        { path: "", lastUsedAt: "invalid" },
      ],
    }),
    {
      colorScheme: "lagoon",
      summary: [
        { path: "/docs/one.md", lastUsedAt: "2026-07-18T01:00:00.000Z" },
      ],
    },
  );
});

Deno.test("records recent files first and updates duplicate paths", () => {
  const settings = recordRecentFile(
    {
      colorScheme: "graphite",
      summary: [
        { path: "/docs/one.md", lastUsedAt: "2026-07-17T01:00:00.000Z" },
      ],
    },
    "/docs/two.md",
    new Date("2026-07-18T02:00:00.000Z"),
  );
  const updated = recordRecentFile(
    settings,
    "/docs/one.md",
    new Date("2026-07-18T03:00:00.000Z"),
  );

  assertEquals(updated.summary, [
    { path: "/docs/one.md", lastUsedAt: "2026-07-18T03:00:00.000Z" },
    { path: "/docs/two.md", lastUsedAt: "2026-07-18T02:00:00.000Z" },
  ]);
});

Deno.test("keeps at most five recent files", () => {
  const summary = Array.from({ length: 6 }, (_, index) => ({
    path: `/docs/${index + 1}.md`,
    lastUsedAt: `2026-07-18T0${index}:00:00.000Z`,
  }));

  assertEquals(
    normalizeSettings({ colorScheme: "graphite", summary }).summary.length,
    5,
  );
});

Deno.test("removes a recent file without changing other settings", () => {
  assertEquals(
    removeRecentFile(
      {
        colorScheme: "rose",
        summary: [
          { path: "/docs/one.md", lastUsedAt: "2026-07-18T01:00:00.000Z" },
          { path: "/docs/two.md", lastUsedAt: "2026-07-18T02:00:00.000Z" },
        ],
      },
      "/docs/one.md",
    ),
    {
      colorScheme: "rose",
      summary: [
        { path: "/docs/two.md", lastUsedAt: "2026-07-18T02:00:00.000Z" },
      ],
    },
  );
});
