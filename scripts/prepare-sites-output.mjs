import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp(".output/server", "dist/server", { recursive: true });
await cp(".output/public", "dist/client", { recursive: true });

await rename("dist/server/index.mjs", "dist/server/index.js");

const wranglerPath = "dist/server/wrangler.json";
const wrangler = JSON.parse(await readFile(wranglerPath, "utf8"));
wrangler.main = "index.js";
wrangler.assets = { ...wrangler.assets, directory: "../client" };
await writeFile(wranglerPath, `${JSON.stringify(wrangler, null, 2)}\n`);
