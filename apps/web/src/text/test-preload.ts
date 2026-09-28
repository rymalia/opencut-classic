// Bun has no canvas, so text measurement (getTextMeasurementContext) throws
// under `bun test`. Install a fixed-metrics OffscreenCanvas for the whole test
// process. It lives in a preload rather than in a test file because
// measure-element.ts caches the first context it creates, so a per-file stub
// would leak into later files anyway.
class FakeOffscreenCanvas {
	getContext() {
		return {
			font: "",
			textBaseline: "alphabetic",
			save() {},
			restore() {},
			measureText(text: string) {
				return {
					width: text.length * 10,
					actualBoundingBoxAscent: 8,
					actualBoundingBoxDescent: 2,
				};
			},
		};
	}
}

if (typeof globalThis.OffscreenCanvas === "undefined") {
	globalThis.OffscreenCanvas =
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		FakeOffscreenCanvas as unknown as typeof OffscreenCanvas;
}
