import { WasmComponentPlugin } from "./component.ts";

await Bun.plugin(WasmComponentPlugin())

export { WasmComponentPlugin }
export type { WasmComponentPluginOptions } from './component.ts'
export default WasmComponentPlugin