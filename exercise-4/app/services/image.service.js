import fs from "node:fs/promises";
import { openai } from "../config/openai.js";
import { withRetry } from "../utils/retry.js";

export async function generateHeader(topic, dir) {
  const result = await withRetry(() =>
    openai.images.generate({
      model: process.env.IMAGE_HEADER_MODEL || "dall-e-3",
      prompt: `
        Create a professional editorial header image
        for an article about "${topic}".
        Modern composition, cinematic lighting,
        sophisticated colors, no text or logos.
      `,
      size: "1792x1024",
      quality: "standard",
      n: 1,
      response_format: "url",
    }),
  );

  const url = result.data?.[0]?.url;

  if (!url) {
    throw new Error("Header image URL missing");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Header download failed");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(`${dir}/header.png`, buffer);

  return "header.png";
}

export async function generateThumbnail(topic, dir) {
  const result = await withRetry(() =>
    openai.images.generate({
      model: process.env.IMAGE_THUMBNAIL_MODEL || "gpt-image-1",
      prompt: `
        Create a striking social media thumbnail
        about "${topic}".
        Bold visual composition, modern professional
        design, high contrast, no text or watermark.
      `,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    }),
  );

  const base64 = result.data?.[0]?.b64_json;

  if (!base64) {
    throw new Error("Thumbnail image data missing");
  }

  await fs.writeFile(`${dir}/thumbnail.png`, Buffer.from(base64, "base64"));

  return "thumbnail.png";
}
