const projectRoot = new URL("../", import.meta.url);
const sourceUrl = new URL("assets/icon.png", projectRoot);
const outputUrl = new URL("assets/icon.icns", projectRoot);
const source = await Deno.readFile(sourceUrl);

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
if (!pngSignature.every((byte, index) => source[index] === byte)) {
  throw new Error("assets/icon.png must be a PNG file");
}

const sourceView = new DataView(
  source.buffer,
  source.byteOffset,
  source.byteLength,
);
const width = sourceView.getUint32(16);
const height = sourceView.getUint32(20);
if (width !== 1024 || height !== 1024) {
  throw new Error(
    `assets/icon.png must be 1024x1024 (received ${width}x${height})`,
  );
}

const headerSize = 8;
const chunkSize = headerSize + source.byteLength;
const output = new Uint8Array(headerSize + chunkSize);
const outputView = new DataView(output.buffer);

output.set(new TextEncoder().encode("icns"), 0);
outputView.setUint32(4, output.byteLength);
output.set(new TextEncoder().encode("ic10"), headerSize);
outputView.setUint32(headerSize + 4, chunkSize);
output.set(source, headerSize * 2);

await Deno.writeFile(outputUrl, output);
console.log(`Generated ${outputUrl.pathname}`);
