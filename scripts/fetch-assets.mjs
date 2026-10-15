// Downloads the CC0 Poly Haven assets this site uses and converts them into
// compact web formats under public/assets/. Re-run any time: npm run assets
// Raw downloads are cached in .asset-cache/ (git-ignored).
// All assets: https://polyhaven.com — CC0 (public domain).
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const cache = path.join(root, '.asset-cache');
const out = path.join(root, 'public', 'assets');

/** Painted (anime) style: surfaces are drawn in code (src/core/painted.ts), so no photo textures. */
const TEXTURES = {};
/** HDRIs used for image-based lighting (1k .hdr is plenty for reflections). */
const HDRIS = []; // toon shading doesn't use image-based lighting
/** Photographic sky backgrounds (tonemapped, resized). */
const SKIES = {}; // skies are painted in a shader
/** Props, packed to .glb with gltf-transform and WebP textures. */
const MODELS = { wooden_lantern_01: 512, vintage_suitcase: 512, brass_goblets: 256, carved_wooden_plate: 256 };

const exists = (p) => access(p).then(() => true, () => false);
async function fetchTo(url, file) {
  if (await exists(file)) return file;
  await mkdir(path.dirname(file), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}
const files = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json();

await mkdir(out, { recursive: true });
const credits = [];

for (const [id, size] of Object.entries(TEXTURES)) {
  const f = await files(id);
  const dir = path.join(out, 'tex', id);
  await mkdir(dir, { recursive: true });
  for (const [key, name, q] of [['Diffuse', 'diff', 80], ['nor_gl', 'nor', 88], ['arm', 'arm', 78]]) {
    const src = await fetchTo(f[key]['1k'].jpg.url, path.join(cache, 'tex', id, `${name}.jpg`));
    await sharp(src).resize(size, size).webp({ quality: q }).toFile(path.join(dir, `${name}.webp`));
  }
  credits.push(id);
  console.log('texture', id);
}

for (const id of HDRIS) {
  const f = await files(id);
  const src = await fetchTo(f.hdri['1k'].hdr.url, path.join(cache, 'hdri', `${id}.hdr`));
  await mkdir(path.join(out, 'hdri'), { recursive: true });
  await writeFile(path.join(out, 'hdri', `${id}.hdr`), await readFile(src));
  credits.push(id);
  console.log('hdri', id);
}

for (const [id, w] of Object.entries(SKIES)) {
  const f = await files(id);
  const src = await fetchTo(f.tonemapped.url, path.join(cache, 'sky', `${id}.jpg`));
  await mkdir(path.join(out, 'sky'), { recursive: true });
  await sharp(src, { limitInputPixels: false }).resize(w, w / 2).webp({ quality: 82 }).toFile(path.join(out, 'sky', `${id}.webp`));
  console.log('sky', id);
}

for (const [id, tex] of Object.entries(MODELS)) {
  const f = await files(id);
  const g = f.gltf['1k'].gltf;
  const dir = path.join(cache, 'models', id);
  const main = await fetchTo(g.url, path.join(dir, path.basename(new URL(g.url).pathname)));
  for (const [rel, v] of Object.entries(g.include ?? {})) {
    const f = await fetchTo(v.url, path.join(dir, rel));
    // Poly Haven ships some 16-bit PNGs; normalise to 8-bit sRGB so the optimiser can read them.
    if (/\.png$/i.test(f)) {
      const buf = await sharp(f).toColourspace('srgb').png().toBuffer();
      await writeFile(f, buf);
    }
  }
  await mkdir(path.join(out, 'models'), { recursive: true });
  const dest = path.join(out, 'models', `${id}.glb`);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(main);
  // Textures → small WebP (done with sharp directly; the CLI's texture step chokes on these PNGs)
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const buf = await sharp(Buffer.from(img)).toColourspace('srgb').resize(tex, tex, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    t.setImage(new Uint8Array(buf)).setMimeType('image/webp').setURI((t.getURI() || t.getName() || 'tex').replace(/\.\w+$/, '') + '.webp');
  }
  doc.createExtension(EXTTextureWebP).setRequired(true);
  await io.write(dest, doc);
  credits.push(id);
  console.log('model', id);
}

await writeFile(
  path.join(out, 'CREDITS.md'),
  `# Asset credits\n\nAll of the following come from [Poly Haven](https://polyhaven.com) under the CC0 licence (public domain).\n\n${credits.map((c) => `- [${c}](https://polyhaven.com/a/${c})`).join('\n')}\n`,
);
console.log('done');
