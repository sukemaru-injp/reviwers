const appRoot = new URL(".", import.meta.url);
const appOutput = "./build/MermaidReviewerCEF.app";

if (Deno.args.includes("--help") || Deno.args.includes("-h")) {
  console.log(`Usage:
  reviwers [path]

Examples:
  reviwers .
  reviwers ./SAMPLE.md

The path can be a Markdown file or a directory containing Markdown files.`);
  Deno.exit(0);
}

const targetPath = await resolveTargetPath(Deno.args[0] ?? ".");

await run(["task", "icon:macos"]);
await run(["task", "build"]);
await run([
  "desktop",
  "--allow-read",
  "--allow-write",
  "--allow-env=HOME",
  "--include=./dist",
  `--output=${appOutput}`,
  "desktop.ts",
  targetPath,
]);

await openApp(appOutput);

async function run(args: string[]): Promise<void> {
  await runCommand("deno", args);
}

async function openApp(path: string): Promise<void> {
  if (Deno.build.os !== "darwin") {
    console.log(`Built ${path}. Open it manually on this platform.`);
    return;
  }

  await runCommand("open", [path]);
}

async function runCommand(commandName: string, args: string[]): Promise<void> {
  const command = new Deno.Command(commandName, {
    args,
    cwd: appRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await command.spawn().status;

  if (!status.success) {
    Deno.exit(status.code);
  }
}

async function resolveTargetPath(path: string): Promise<string> {
  try {
    return await Deno.realPath(path);
  } catch {
    if (path.startsWith("/")) {
      return path;
    }

    return `${Deno.cwd()}/${path}`;
  }
}
