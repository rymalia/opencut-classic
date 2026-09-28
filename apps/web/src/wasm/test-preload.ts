// opencut-wasm is built with wasm-pack's bundler target, whose entry does
// `import * as wasm from "./opencut_wasm_bg.wasm"`. Bundlers support that
// (ESM-integration) import; bun's runtime doesn't, so under `bun test` the
// module comes back empty and `wasm.__wbindgen_start` is undefined. This
// preload instantiates the .wasm the way a bundler would.
import { plugin } from "bun";
import { dirname, join } from "node:path";

plugin({
	name: "opencut-wasm-esm-integration",
	setup(build) {
		build.onLoad({ filter: /opencut_wasm_bg\.wasm$/ }, async ({ path }) => {
			const bytes = await Bun.file(path).arrayBuffer();
			const wasmModule = new WebAssembly.Module(bytes);
			const imports: WebAssembly.Imports = {};
			for (const { module: specifier } of WebAssembly.Module.imports(
				wasmModule,
			)) {
				// Plain filesystem join (not a URL) so paths with spaces resolve to
				// the same module the wasm-pack entry imports.
				imports[specifier] ??= await import(join(dirname(path), specifier));
			}
			const instance = new WebAssembly.Instance(wasmModule, imports);
			return { exports: instance.exports, loader: "object" };
		});
	},
});
