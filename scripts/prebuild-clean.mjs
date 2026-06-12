import { rm } from "node:fs/promises";

const staleFiles = ["app/lib/" + "supa" + "base.ts"];

await Promise.all(
  staleFiles.map((file) =>
    rm(file, { force: true }).catch((error) => {
      throw new Error(`Could not remove stale file ${file}: ${error.message}`);
    }),
  ),
);
