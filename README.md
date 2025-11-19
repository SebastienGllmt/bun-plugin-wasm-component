# `bun-plugin-wasm-component`

# Installation

```sh
$ bun add -D bun-plugin-wasm-component
```

Start by registering it in your [bunfig.toml](https://bun.sh/docs/runtime/bunfig):

```toml
preload = ["bun-plugin-wasm-component"]
```

## Bundler Usage


`bun-plugin-wasm-component` lets you bundle WASM components with [`Bun.build`](https://bun.sh/docs/bundler).

```ts
// build.ts
// to use: bun run build.ts

import { WasmComponentPlugin } from "bun-plugin-wasm-component/component.ts";
Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "browser",
  sourcemap: true, // sourcemaps not yet supported
  plugins: [
    WasmComponentPlugin(),
  ],
});
```


# Release

1. `bun install`
2. `bun run publish`

# Careful

1. This project may cause issues if you have a custom WASM loader for your project that are *not* WASM components (regular WASM modules). See [#5303](https://github.com/oven-sh/bun/issues/5303)
2. This project outputs generated files in a `gen-ts` folder at your project root, but also generates a `.d.ts` file next to your WASM component due to [#5314](https://github.com/oven-sh/bun/issues/5314)
