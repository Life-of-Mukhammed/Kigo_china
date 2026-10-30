import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/media", { recursive: true });
const assets = {
  hero: "b0afafa2c3ce1d88c85d21ce44b68e6c",
  football: "1c2f3c81324220130d4ad08e648784a4",
  tennis: "13e3e74e1c8613263887e300dceeaf73",
  basketball: "07b0c10fb9b2d49a2a0dcdce20f37286",
  padel: "02ef3ff165d336757185093837aead56",
  volleyball: "0ada455b43091bf5282dc75c8aef5912",
  sport: "98a9abb990130d4d41b45248810045e1",
};
const report = [];
for (const [name, id] of Object.entries(assets)) {
  const image = sharp("public/assets/" + id),
    meta = await image.metadata();
  await image
    .clone()
    .rotate()
    .webp({ quality: 94, effort: 6, smartSubsample: true })
    .toFile("public/media/" + name + ".webp");
  for (const width of [480, 960])
    if ((meta.width || 0) > width)
      await image
        .clone()
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 92, effort: 6 })
        .toFile("public/media/" + name + "-" + width + ".webp");
  report.push({
    name,
    width: meta.width,
    height: meta.height,
    upscaled: false,
  });
}
await writeFile("public/media/manifest.json", JSON.stringify(report, null, 2));
console.log(report);
