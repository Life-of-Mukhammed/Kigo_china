import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

globalThis.__chatgptHeaders = new Headers({
  "oai-authenticated-user-id": "forged-owner",
  "oai-authenticated-user-email": "owner@example.com",
  "oai-authenticated-user-full-name": "Test%20Owner",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
});

await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {getChatGPTUser,chatGPTAuthAvailable} from './app/chatgpt-auth';`,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "outputs/chatgpt-auth-test.mjs",
  plugins: [{
    name: "mock-next-request",
    setup(builder) {
      builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "test" }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, (args) => ({
        contents: args.path === "headers"
          ? "export const headers=async()=>globalThis.__chatgptHeaders;"
          : "export const redirect=(path)=>{throw new Error(path)};",
        loader: "js",
      }));
    },
  }],
});

const { getChatGPTUser, chatGPTAuthAvailable } = await import(pathToFileURL(`${process.cwd()}/outputs/chatgpt-auth-test.mjs`));
process.env.VERCEL = "1";
assert.equal(chatGPTAuthAvailable(), false);
assert.equal(await getChatGPTUser(), null, "public Vercel must ignore caller-supplied identity headers");
delete process.env.VERCEL;
assert.equal(chatGPTAuthAvailable(), true);
assert.deepEqual(await getChatGPTUser(), {
  userId: "forged-owner",
  email: "owner@example.com",
  displayName: "Test Owner",
  fullName: "Test Owner",
});
console.log("PASS: public Vercel ignores spoofable ChatGPT identity headers; trusted Sites runtime still decodes them.");
