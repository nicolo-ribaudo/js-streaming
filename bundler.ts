import { parse } from "@babel/parser";
import { fromFileUrl, relative } from "@std/path";

if (import.meta.main) {
  const bundleStream = bundle(Deno.args[0], new URL("./", import.meta.url));
  bundleStream.pipeTo(Deno.stdout.writable);
}

export function bundle(entrypoint: string, baseURL: URL) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    type: "bytes",
    async start(controller) {
      await loadModulesGraph(
        new URL(entrypoint, baseURL),
        baseURL,
        new Set(),
        new Set(),
        (specifier, source) => {
          const encodedSpecifier = encoder.encode(specifier);
          const encodedSource = encoder.encode(source);
          const lenghts = [encodedSpecifier.length, encodedSource.length];

          controller.enqueue(new Uint8Array(new Uint32Array(lenghts).buffer));
          controller.enqueue(encodedSpecifier);
          controller.enqueue(encodedSource);
        },
      );
      controller.close();
    },
  });
}

async function loadModulesGraph(
  url: URL,
  baseURL: URL,
  seen: Set<string>,
  stack: Set<string>,
  push: (specifier: string, source: string) => void,
) {
  if (stack.has(url.href)) throw new Error("Cycles are not supported yet.");
  stack.add(url.href);

  const module = await loadModule(url);
  const { source, dependencies } = rewriteImports(module, baseURL);

  seen.add(url.href);

  for (const dependencyURL of dependencies) {
    if (seen.has(dependencyURL.href)) continue;
    await loadModulesGraph(dependencyURL, baseURL, seen, stack, push);
  }

  stack.delete(url.href);

  push(relativeURL(baseURL, url), source);
}

interface Module {
  url: URL;
  source: string;
  imports: Array<{ specifier: string; range: [number, number] }>;
}

async function loadModule(url: URL): Promise<Module> {
  const source = await Deno.readTextFile(url);

  const ast = parse(source, {
    sourceType: "module",
    plugins: ["explicitResourceManagement"],
  });

  const imports = [];

  for (const stmt of ast.program.body) {
    if (stmt.type === "ImportDeclaration") {
      imports.push({
        specifier: (stmt.source as { value: string }).value,
        range: [stmt.source.start, stmt.source.end] satisfies [number, number],
      });
    }
  }

  return { url, source, imports };
}

function rewriteImports(
  module: Module,
  baseURL: URL,
): { source: string; dependencies: URL[] } {
  let { source } = module;

  const dependencies = [];

  for (let i = module.imports.length - 1; i >= 0; i--) {
    const { specifier, range } = module.imports[i];
    const depURL = new URL(specifier, module.url);
    const rebasedSpecifier = relativeURL(baseURL, depURL);
    source = source.slice(0, range[0]) +
      JSON.stringify("bundle://" + rebasedSpecifier) +
      source.slice(range[1]);
    dependencies.unshift(depURL);
  }

  return { source, dependencies };
}

function relativeURL(from: URL, to: URL) {
  return "./" + relative(fromFileUrl(from), fromFileUrl(to));
}
