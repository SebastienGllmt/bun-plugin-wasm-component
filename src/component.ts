import { plugin, type BunPlugin } from "bun";
import { $ } from "bun";
import path from "path";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { write } from "bun";

function findProjectRoot(start: string) {
  let dir = start;

  while (true) {
    if (existsSync(join(dir, "package.json")) || existsSync(join(dir, "deno.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error("Project root not found");
}

function detectWasmKind(bytes: Uint8Array): "module" | "component" | "unknown" {
  // Magic for all WASM files: 00 61 73 6D
  if (
    bytes[0] !== 0x00 ||
    bytes[1] !== 0x61 ||
    bytes[2] !== 0x73 ||
    bytes[3] !== 0x6D
  ) {
    return "unknown"; // Not a wasm binary
  }

  // top-level type (little-endian)
  const version =
    bytes[4]! |
    (bytes[5]! << 8) |
    (bytes[6]! << 16) |
    (bytes[7]! << 24);

  if (version === 0x01) return "module";
  if (version === 0x1000D) return "component";

  return "unknown"; // Future versions or malformed input
}

type WasmComponentPluginOptions = {
};
function WasmComponentPlugin(options: WasmComponentPluginOptions = {}): BunPlugin {
  return {
    name: "bun-plugin-wasm-component",

    setup(build) {
      build.onLoad({ filter: /.*.wasm/ }, async (args) => {
        // TODO: probably best to put all of this in onResolve
        //       but blocked on https://github.com/oven-sh/bun/issues/5314
        // 1) Resolve args.path (despite the fact it's a relative path)
        const file = Bun.file(args.path);
        // 2) check if it's a WASM component
        const kind = detectWasmKind(new Uint8Array(await file.arrayBuffer()));
        if (kind !== "component") {
          // TODO: this breaks if the user had any other WASM loader plugin
          //       fixed by https://github.com/oven-sh/bun/issues/5303
          return {
            loader: args.loader,
            contents: await Bun.file(args.path).text(),
          }
        }
        // 3) generate the type and bindings
        const filename = path.parse(args.path).name;
        await $`jco transpile ${args.path} -o ./gen-ts/${filename}`;
        const newPath = `./gen-ts/${filename}/${filename}.js`;
        // 4) Patch relative imports
        //    as JS glue contains relative imports
        //    and Bun doesn't know our onLoad is loading contents from a different dir 
        const contents = await Bun.file(newPath).text();
        const targetName = `${filename}.core.wasm`;
        const projectRoot = findProjectRoot(args.path);
        // Convert from the path where the WASM file exists to the root folder
        const pathToRoot = path.relative(path.dirname(args.path), projectRoot);
        const patchedContents = contents.replace(
          `./${targetName}`,
          `${pathToRoot}/gen-ts/${filename}/${targetName}`
        );
        // 5) Register the type mapping with TS
        const tsMapping = `
  export * from '${pathToRoot}/gen-ts/${filename}/${filename}.d.ts'
  `;
        await write(args.path + ".d.ts", tsMapping);
        return {
          loader: "ts",
          contents: patchedContents
        }
      });
    },
  };
};

export default WasmComponentPlugin({}) as BunPlugin;
export { WasmComponentPlugin, type WasmComponentPluginOptions };