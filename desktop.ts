const DIST_ROOT = new URL("./dist/", import.meta.url);
const initialPath = Deno.args[0] ? new URL(Deno.args[0], cwdUrl()) : null;
const desktopDeno = Deno as typeof Deno & {
  BrowserWindow?: new (options: {
    title?: string;
    width?: number;
    height?: number;
  }) => {
    setSize?: (width: number, height: number) => void;
    setTitle?: (title: string) => void;
  };
};

if (desktopDeno.BrowserWindow) {
  const win = new desktopDeno.BrowserWindow({
    title: "Mermaid Reviewer",
    width: 1100,
    height: 760,
  });
  win.setTitle?.("Mermaid Reviewer");
  win.setSize?.(1100, 760);
}

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/api/initial-file") {
    return await initialFileResponse();
  }

  const pathname = decodeURIComponent(url.pathname);
  const filePath = pathname === "/" ? "index.html" : pathname.slice(1);

  return await serveFile(filePath);
});

async function serveFile(filePath: string): Promise<Response> {
  const safePath = filePath.replace(/^\/+/, "");

  if (safePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const fileUrl = new URL(safePath, DIST_ROOT);

  try {
    const body = await Deno.readFile(fileUrl);
    return new Response(body, {
      headers: {
        "content-type": contentType(safePath),
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound && safePath !== "index.html") {
      return serveFile("index.html");
    }

    if (error instanceof Deno.errors.NotFound) {
      return new Response("Run `deno task build` first.", { status: 404 });
    }

    throw error;
  }
}

function contentType(filePath: string): string {
  const extension = filePath.match(/\.[^.]+$/)?.[0] ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

async function initialFileResponse(): Promise<Response> {
  if (!initialPath) {
    return Response.json({ file: null });
  }

  try {
    const fileUrl = await resolveMarkdownFile(initialPath);

    if (!fileUrl) {
      return Response.json({ file: null });
    }

    const text = await Deno.readTextFile(fileUrl);
    return Response.json({
      file: {
        name: fileUrl.pathname.split("/").at(-1) ?? "Untitled.md",
        path: fileUrl.pathname,
        text,
      },
    });
  } catch (error) {
    return Response.json(
      {
        file: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}

async function resolveMarkdownFile(pathUrl: URL): Promise<URL | null> {
  const stat = await Deno.stat(pathUrl);

  if (stat.isFile) {
    return isMarkdown(pathUrl.pathname) ? pathUrl : null;
  }

  if (!stat.isDirectory) {
    return null;
  }

  for await (const entry of Deno.readDir(pathUrl)) {
    if (entry.isFile && isMarkdown(entry.name)) {
      return new URL(entry.name, ensureTrailingSlash(pathUrl));
    }
  }

  return null;
}

function isMarkdown(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

function cwdUrl(): URL {
  return new URL(`file://${Deno.cwd().replaceAll("\\", "/")}/`);
}

function ensureTrailingSlash(url: URL): URL {
  return new URL(url.href.endsWith("/") ? url.href : `${url.href}/`);
}
