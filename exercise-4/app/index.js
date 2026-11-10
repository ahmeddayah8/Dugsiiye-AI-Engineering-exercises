import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  generateArticle,
  generateSummary,
  generateSocialPosts,
} from "./services/content.service.js";

import { generateHeader, generateThumbnail } from "./services/image.service.js";

import { generateNarration } from "./services/audio.service.js";

import { createZip } from "./services/export.service.js";

const topic = process.argv[2];
const language = process.argv[3] || "English";

if (!topic?.trim()) {
  console.error('Usage: npm start -- "Your topic" "English"');
  process.exit(1);
}

const runId = randomUUID().slice(0, 8);

const dir = path.resolve("output", `studio-${runId}`);

await fs.mkdir(dir, { recursive: true });

const results = {
  topic,
  language,
  createdAt: new Date().toISOString(),
  files: [],
  errors: [],
};

async function saveText(filename, content) {
  await fs.writeFile(path.join(dir, filename), content, "utf8");

  results.files.push(filename);
}

async function optionalTask(name, task) {
  try {
    const file = await task();
    results.files.push(file);
    console.log(`✓ ${name}`);
  } catch (error) {
    results.errors.push({
      task: name,
      message: error.message,
    });

    console.warn(`✗ ${name}: ${error.message}`);
  }
}

try {
  console.log("AI Content Studio started!");

  // 1. Generate article
  const article = await generateArticle(topic, language);

  await saveText("article.md", article);
  console.log("✓ Article generated");

  // 2. Generate summary
  await optionalTask("Summary", async () => {
    const summary = await generateSummary(article, language);

    await saveText("summary.md", summary);
  });

  // 3. Generate social posts
  await optionalTask("Social posts", async () => {
    const posts = await generateSocialPosts(article, language);

    await saveText("social-posts.md", posts);
  });

  // 4. Generate images
  await optionalTask("Header image", () => generateHeader(topic, dir));

  await optionalTask("Thumbnail", () => generateThumbnail(topic, dir));

  // 5. Generate narration
  await optionalTask("Narration", () =>
    generateNarration(article, dir, {
      voice: "alloy",
      emotion: "confident and engaging",
    }),
  );

  // 6. Save report
  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(results, null, 2),
  );

  // 7. Export
  const zipPath = await createZip(dir);

  console.log("\nContent Studio completed!");
  console.log(`Folder: ${dir}`);
  console.log(`ZIP: ${zipPath}`);

  if (results.errors.length) {
    console.log(`${results.errors.length} optional tasks failed.`);
  }
} catch (error) {
  console.error("Critical error:", error.message);

  process.exitCode = 1;
}
