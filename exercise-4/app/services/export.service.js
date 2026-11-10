import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

export function createZip(sourceDir) {
  return new Promise((resolve, reject) => {
    const zipPath = `${sourceDir}.zip`;

    const output = fs.createWriteStream(zipPath);

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => resolve(zipPath));
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    archive.directory(sourceDir, path.basename(sourceDir));

    archive.finalize();
  });
}
