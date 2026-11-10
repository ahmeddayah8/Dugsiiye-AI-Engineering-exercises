import fs from "node:fs/promises";
import { openai } from "../config/openai.js";
import { withRetry } from "../utils/retry.js";

export async function generateNarration(text, dir, options = {}) {
  const { voice = "alloy", emotion = "warm and engaging" } = options;

  const response = await withRetry(() =>
    openai.audio.speech.create({
      model: process.env.AUDIO_MODEL || "gpt-4o-mini-tts",
      voice,
      input: text.slice(0, 3500),
      instructions: `
        Speak in a ${emotion} tone.
        Use natural pacing and clear pronunciation.
        Sound like a professional narrator.
      `,
      response_format: "mp3",
    }),
  );

  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(`${dir}/narration.mp3`, buffer);

  return "narration.mp3";
}
