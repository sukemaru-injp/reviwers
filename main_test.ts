import { assertEquals } from "@std/assert";
import { extractMermaidBlocks } from "./src/domain/mermaidBlocks.ts";

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
