import "dotenv/config";
import OpenAI from "openai";
import Replicate from "replicate";
import { fal } from "@fal-ai/client";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";

const rl = createInterface({ input: stdin, output: stdout });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const IMAGE_DIR = path.resolve("output/images");
const GALLERY_FILE = path.resolve("output/gallery.html");

// Helpers
function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "art"
  );
}

function escapeHTML(text) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

async function downloadImage(url, filename) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(IMAGE_DIR, filename), buffer);

  return filename;
}

// 1. OpenAI Image Generation
async function generateOpenAI(prompt, filename) {
  console.log("\n[1/3] Generating with OpenAI...");

  const response = await openai.images.generate({
    model: "gpt-image-1-mini",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const image = response.data?.[0];

  if (image?.b64_json) {
    await writeFile(
      path.join(IMAGE_DIR, filename),
      Buffer.from(image.b64_json, "base64"),
    );
  } else if (image?.url) {
    await downloadImage(image.url, filename);
  } else {
    throw new Error("OpenAI returned no image.");
  }

  console.log("Saved:", filename);
  return filename;
}

// 2. Replicate Image Generation
async function generateReplicate(prompt, filename) {
  console.log("\n[2/3] Generating with Replicate...");

  const result = await replicate.run("black-forest-labs/flux-schnell", {
    input: {
      prompt,
      num_outputs: 1,
      aspect_ratio: "1:1",
      output_format: "webp",
    },
  });

  if (!result?.[0]) {
    throw new Error("Replicate returned no image.");
  }

  const blob = await result[0].blob();
  await writeFile(
    path.join(IMAGE_DIR, filename),
    Buffer.from(await blob.arrayBuffer()),
  );

  console.log("Saved:", filename);
  return filename;
}

// 3. fal.ai Image Generation
async function generateFal(prompt, filename) {
  console.log("\n[3/3] Generating with fal.ai...");

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "square_hd",
      num_images: 1,
    },
    logs: true,
    onQueueUpdate(update) {
      console.log("fal.ai status:", update.status);
    },
  });

  const imageUrl = result.data?.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error("fal.ai returned no image.");
  }

  await downloadImage(imageUrl, filename);
  console.log("Saved:", filename);

  return filename;
}

// 4. Create variations
async function createVariations(theme, best, slug) {
  console.log("\nCreating two variations...");

  const styles = [
    {
      name: "cinematic",
      prompt: `Create a cinematic interpretation of ${theme}.
      Dramatic lighting, detailed environment, epic composition.`,
    },
    {
      name: "watercolor",
      prompt: `Create a watercolor interpretation of ${theme}.
      Soft colors, artistic brush strokes, elegant composition.`,
    },
  ];

  const variations = [];

  for (const style of styles) {
    const filename = `${slug}-variation-${style.name}.png`;

    const image = await generateOpenAI(
      `${style.prompt}
      The chosen original concept was created by ${best.service}.
      Keep the main theme recognizable.`,
      filename,
    );

    variations.push({
      service: "OpenAI Variation",
      filename: image,
      title: `${style.name} variation`,
    });
  }

  return variations;
}

// 5. Generate HTML gallery
async function createGallery(theme, images) {
  const cards = images
    .map(
      (image) => `
    <article class="card">
      <img
        src="images/${encodeURIComponent(image.filename)}"
        alt="${escapeHTML(image.title)}"
        loading="lazy"
      />
      <div class="content">
        <h2>${escapeHTML(image.title)}</h2>
        <p>${escapeHTML(image.service)}</p>
        <a href="images/${encodeURIComponent(image.filename)}"
           download>
          Download Image
        </a>
      </div>
    </article>
  `,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0" />
  <title>AI Art Gallery</title>
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #0b1020;
      color: #fff;
    }

    header {
      text-align: center;
      padding: 60px 20px 30px;
    }

    h1 { font-size: 42px; margin: 0 0 12px; }
    header p { color: #a5b4fc; }

    .gallery {
      max-width: 1200px;
      margin: auto;
      padding: 30px 20px 70px;
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
    }

    .card {
      background: #172036;
      border: 1px solid #2b3650;
      border-radius: 16px;
      overflow: hidden;
    }

    .card img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
    }

    .content { padding: 20px; }
    .content h2 { margin: 0 0 10px; }
    .content p { color: #94a3b8; }

    a {
      display: inline-block;
      margin-top: 12px;
      padding: 12px 18px;
      background: #6366f1;
      border-radius: 8px;
      color: white;
      text-decoration: none;
    }

    a:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <header>
    <h1>AI Art Gallery</h1>
    <p>Theme: ${escapeHTML(theme)}</p>
    <p>Generated using AI image services</p>
  </header>

  <main class="gallery">
    ${cards}
  </main>
</body>
</html>`;

  await writeFile(GALLERY_FILE, html, "utf8");
  console.log("\nGallery created:", GALLERY_FILE);
}

// Main
async function main() {
  for (const key of ["OPENAI_API_KEY", "REPLICATE_API_TOKEN", "FAL_KEY"]) {
    if (!process.env[key]) {
      throw new Error(`Missing ${key} in .env`);
    }
  }

  await mkdir(IMAGE_DIR, { recursive: true });

  console.log("\n=== AI ART GALLERY GENERATOR ===\n");

  const theme = (await rl.question("Enter art theme: ")).trim();

  if (!theme) throw new Error("Theme is required.");

  const slug = slugify(theme);
  const prompt = `Create a beautiful, highly detailed artwork
  about ${theme}. Professional digital art, rich details,
  visually compelling composition.`;

  const images = [];

  // Generate initial images
  const services = [
    {
      service: "OpenAI",
      filename: `${slug}-openai.png`,
      generate: generateOpenAI,
    },
    {
      service: "Replicate",
      filename: `${slug}-replicate.webp`,
      generate: generateReplicate,
    },
    {
      service: "fal.ai",
      filename: `${slug}-fal.png`,
      generate: generateFal,
    },
  ];

  for (const item of services) {
    try {
      const filename = await item.generate(prompt, item.filename);

      images.push({
        service: item.service,
        filename,
        title: `${theme} - ${item.service}`,
      });
    } catch (error) {
      console.error(`${item.service} failed:`, error.message);
    }
  }

  if (images.length === 0) {
    throw new Error("All image services failed.");
  }

  // Choose the best image manually
  console.log("\nGenerated images:");

  images.forEach((image, index) => {
    console.log(`${index + 1}. ${image.service}: ${image.filename}`);
  });

  let selected;

  while (true) {
    const answer = await rl.question("\nChoose best image number: ");

    const index = Number(answer) - 1;

    if (Number.isInteger(index) && images[index]) {
      selected = images[index];
      break;
    }

    console.log("Please enter a valid image number.");
  }

  console.log("Selected:", selected.filename);

  const variations = await createVariations(theme, selected, slug);

  images.push(...variations);

  await createGallery(theme, images);

  console.log("\nSUCCESS!");
  console.log("Images saved in:", IMAGE_DIR);
  console.log("Open:", GALLERY_FILE);
}

main()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
