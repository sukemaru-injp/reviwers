const DIST_ROOT = new URL("./dist/", import.meta.url);
const initialPath = Deno.args[0] ? new URL(Deno.args[0], cwdUrl()) : null;
const SETTINGS_DIR = new URL(".reviewers/", homeUrl());
const SETTINGS_FILE = new URL("settings.json", SETTINGS_DIR);
const DEFAULT_SETTINGS: AppSettings = {
  colorScheme: "graphite",
};
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

  if (url.pathname === "/api/settings") {
    return await settingsResponse(req);
  }

  if (url.pathname === "/api/initial-file") {
    return await initialFileResponse();
  }

  if (url.pathname === "/api/read-markdown") {
    return await readMarkdownResponse(url.searchParams.get("path"));
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

interface AppSettings {
  colorScheme: string;
}

async function settingsResponse(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return Response.json({ settings: await readSettings() });
  }

  if (req.method === "PUT") {
    try {
      const body = await req.json();
      const settings = normalizeSettings(body);
      await writeSettings(settings);
      return Response.json({ settings });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { allow: "GET, PUT" },
  });
}

async function readSettings(): Promise<AppSettings> {
  try {
    const text = await Deno.readTextFile(SETTINGS_FILE);
    return normalizeSettings(JSON.parse(text));
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof SyntaxError
    ) {
      return DEFAULT_SETTINGS;
    }

    throw error;
  }
}

async function writeSettings(settings: AppSettings): Promise<void> {
  await Deno.mkdir(SETTINGS_DIR, { recursive: true });
  await Deno.writeTextFile(
    SETTINGS_FILE,
    `${JSON.stringify(normalizeSettings(settings), null, 2)}\n`,
  );
}

function normalizeSettings(value: unknown): AppSettings {
  const settings = value && typeof value === "object"
    ? value as Partial<AppSettings>
    : {};

  return {
    colorScheme: typeof settings.colorScheme === "string"
      ? settings.colorScheme
      : DEFAULT_SETTINGS.colorScheme,
  };
}

async function initialFileResponse(): Promise<Response> {
  if (!initialPath) {
    return Response.json({ file: null });
  }

  return await markdownFileResponse(initialPath);
}

async function readMarkdownResponse(path: string | null): Promise<Response> {
  if (!path?.trim()) {
    return Response.json(
      { file: null, error: "Path is required." },
      { status: 400 },
    );
  }

  return await markdownFileResponse(new URL(path, cwdUrl()));
}

async function markdownFileResponse(pathUrl: URL): Promise<Response> {
  try {
    const fileUrl = await resolveMarkdownFile(pathUrl);

    if (!fileUrl) {
      return Response.json(
        { file: null, error: "Markdown file was not found." },
        { status: 404 },
      );
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

function homeUrl(): URL {
  const home = Deno.env.get("HOME") ?? Deno.cwd();
  return new URL(`file://${home.replaceAll("\\", "/")}/`);
}

function ensureTrailingSlash(url: URL): URL {
  return new URL(url.href.endsWith("/") ? url.href : `${url.href}/`);
}
