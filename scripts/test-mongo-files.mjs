import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

const files = new Map();
globalThis.__mongoFileMocks = { files };
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {putMongoFile,getMongoFile} from './lib/mongo-files';`,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "outputs/mongo-files-test.mjs",
  plugins: [{
    name: "mock-mongodb",
    setup(builder) {
      builder.onResolve({ filter: /^mongodb$/ }, () => ({ path: "mongodb", namespace: "mock-mongodb" }));
      builder.onLoad({ filter: /.*/, namespace: "mock-mongodb" }, () => ({
        contents: `
          class MongoClient {
            async connect(){return this}
            db(){return {collection:()=>({
              async updateOne(filter,update){globalThis.__mongoFileMocks.files.set(filter._id,{_id:filter._id,...update.$set})},
              async findOne(filter){return globalThis.__mongoFileMocks.files.get(filter._id)||null}
            })}}
          }
          export {MongoClient};
        `,
        loader: "js",
      }));
    },
  }],
});

process.env.MONGODB_URI = "mongodb://test.invalid";
process.env.MONGODB_DB = "kigo-test";
delete process.env.R2_ENDPOINT;
const { putMongoFile, getMongoFile } = await import(pathToFileURL(`${process.cwd()}/outputs/mongo-files-test.mjs`));
const source = new Uint8Array([0, 1, 2, 127, 255]);
await putMongoFile("sample-image", source, "image/webp", { owner: "test-user" });
source[0] = 9;
const restored = await getMongoFile("sample-image");
assert.deepEqual([...restored.bytes], [0, 1, 2, 127, 255], "stored bytes must be copied and preserved");
assert.equal(restored.contentType, "image/webp");
assert.deepEqual(restored.metadata, { owner: "test-user" });
assert.equal(await getMongoFile("missing"), null);
console.log("PASS: MongoDB file fallback preserves binary bytes, MIME, metadata, and missing-file behavior.");
