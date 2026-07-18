import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceDirectory = dirname(dirname(packageDirectory));
const outputDirectory = join(packageDirectory, "dist");

const modules = [
  {
    source: join(workspaceDirectory, "packages/core/dist"),
    target: join(outputDirectory, "core"),
    replacements: [],
  },
  {
    source: join(workspaceDirectory, "packages/react/dist"),
    target: join(outputDirectory, "react"),
    replacements: [["@schedra/core", "../core/index.js"]],
  },
  {
    source: join(workspaceDirectory, "packages/react-popover/dist"),
    target: join(outputDirectory, "react-popover"),
    replacements: [["@schedra/react", "../react/index.js"]],
  },
];

await rm(outputDirectory, { force: true, recursive: true });

for (const module of modules) {
  await cp(module.source, module.target, { recursive: true });
  await rewriteImports(module.target, module.replacements);
}

async function rewriteImports(directory, replacements) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      await rewriteImports(path, replacements);
      continue;
    }

    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".d.ts")) {
      continue;
    }

    let contents = await readFile(path, "utf8");

    for (const [from, to] of replacements) {
      contents = contents.replaceAll(`"${from}"`, `"${to}"`);
    }

    await writeFile(path, contents);
  }
}
