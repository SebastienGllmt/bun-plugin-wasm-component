import { type BunPlugin } from "bun";
import { $ } from "bun";
import path from "path";
import { join, dirname } from "path";
import { existsSync, readdirSync, rmSync } from "fs";
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

async function getFileHash(buffer: ArrayBuffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

function cleanupOldGenTs() {
  const genTsDir = "./gen-ts";
  if (!existsSync(genTsDir)) return;
  const folders = readdirSync(genTsDir);
  for (const folder of folders) {
    // only delete folders that match the pattern that our project creates
    // in case the user has their own `gen-ts` folder for some reason
    if (folder.match(/-[a-f0-9]{8}$/)) {
      rmSync(join(genTsDir, folder));
    }
  }
}

type WasmComponentPluginOptions = {
};
function WasmComponentPlugin(options: WasmComponentPluginOptions = {}): BunPlugin {
  return {
    name: "bun-plugin-wasm-component",

    async setup(build) {
      // TODO: don't delete old files
      //       as this loader may be called by different build targets that have different imports
      //       as one build target breaking another could leave to subtle bugs
      // cleanupOldGenTs();
      build.onLoad({ filter: /.*.wasm/ }, async (args) => {
        // TODO: probably best to put all of this in onResolve
        //       but blocked on https://github.com/oven-sh/bun/issues/5314
        // 1) Resolve args.path (despite the fact it's a relative path)
        const wasmFileContents = await Bun.file(args.path).arrayBuffer();
        // 2) check if it's a WASM component
        const kind = detectWasmKind(new Uint8Array(wasmFileContents));
        if (kind !== "component") {
          // TODO: this breaks if the user had any other WASM loader plugin
          //       fixed by https://github.com/oven-sh/bun/issues/5303
          return {
            loader: args.loader,
            contents: await Bun.file(args.path).text(),
          }
        }
        // 3) generate the type and bindings
        const wasmHash = await getFileHash(wasmFileContents);
        const filename = path.parse(args.path).name;
        const folderName = `${filename}-${wasmHash.substring(0, 8)}`;
        await $`jco transpile ${args.path} -o ./gen-ts/${folderName}`;
        const newPath = `./gen-ts/${folderName}/${filename}.js`;
        // 4) Patch relative imports
        //    as JS glue contains relative imports
        //    and Bun doesn't know our onLoad is loading contents from a different dir 
        const jsShimContents = await Bun.file(newPath).text();
        const targetName = `${filename}.core.wasm`;
        const projectRoot = findProjectRoot(args.path);
        // Convert from the path where the WASM file exists to the root folder
        const pathToRoot = path.relative(path.dirname(args.path), projectRoot);
        const patchedContents = jsShimContents.replace(
          `./${targetName}`,
          `${pathToRoot}/gen-ts/${folderName}/${targetName}`
        );
        // 5) Register the type mapping with TS
        const tsMapping = `
  export * from '${pathToRoot}/gen-ts/${folderName}/${filename}.js'
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