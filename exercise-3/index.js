import "dotenv/config";
import OpenAI from "openai";
import fs from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  timeout: 120000,
  maxRetries: 1,
});

const OUTPUT_DIR = path.resolve("output");

const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "tts-1";

const VOICE = process.env.OPENAI_VOICE || "alloy";

const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

// Helper: Save text files
async function saveText(filename, content) {
  const filepath = path.join(OUTPUT_DIR, filename);
  await writeFile(filepath, content, "utf8");
  console.log("Saved:", filename);
}

// 1. Speech-to-Text

async function transcribeAudio(audioPath) {
  console.log("\n[1/5] Transcribing audio...");

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "json",
  });

  console.log("Raw transcription:", transcription);

  const text =
    typeof transcription === "string" ? transcription : transcription?.text;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error(
      "Transcription returned no valid text. Check the API response.",
    );
  }

  await saveText("transcription.txt", text);

  console.log("\nTranscription:\n", text);

  return text;
}

// Helper: Generate text using OpenAI

async function generateText(instructions, content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("generateText received empty or undefined content.");
  }

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: instructions,
      },
      {
        role: "user",
        content: content,
      },
    ],
    temperature: 0.3,
  });

  const text = response.choices?.[0]?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Text generation returned no content.");
  }

  return text.trim();
}

// 2. Generate Summary
async function summarizeContent(text) {
  console.log("\n[2/5] Generating summary...");

  const summary = await generateText(
    `You are a professional content summarizer.
     Summarize the transcript clearly in 3-5 sentences.
     Preserve important facts and use the original language.`,
    text,
  );

  await saveText("summary.txt", summary);
  return summary;
}

// 3. Enhance Content
async function enhanceContent(text) {
  console.log("\n[3/5] Enhancing content...");

  const enhanced = await generateText(
    `You are a professional content editor.
     Improve grammar, clarity, flow and structure.
     Preserve the original meaning and language.
     Make the text natural for spoken narration.
     Do not invent facts, quotes or statistics.
     Return only the enhanced text.`,
    text,
  );

  await saveText("enhanced.txt", enhanced);
  return enhanced;
}

// 4. OpenAI Text-to-Speech
async function generateOpenAISpeech(text) {
  console.log("\n[4/5] Generating OpenAI speech...");

  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: VOICE,
    input: text,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  const filepath = path.join(OUTPUT_DIR, "openai-speech.mp3");

  await writeFile(filepath, buffer);

  console.log("Saved: openai-speech.mp3");
  return filepath;
}

// 5. ElevenLabs Text-to-Speech
async function generateElevenLabsSpeech(text) {
  console.log("\n[5/5] Generating ElevenLabs speech...");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVEN_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${details.slice(0, 500)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const filepath = path.join(OUTPUT_DIR, "elevenlabs-speech.mp3");

  await writeFile(filepath, buffer);

  console.log("Saved: elevenlabs-speech.mp3");
  return filepath;
}

// Compare files and save quality evaluation template
async function compareSpeech(results) {
  console.log("\n=== SPEECH COMPARISON ===");

  const comparison = {
    note: "Listen to both files and rate their quality manually.",
    openai: {
      success: Boolean(results.openai),
      filename: results.openai ? "openai-speech.mp3" : null,
      sizeKB: null,
      naturalness: null,
      clarity: null,
      pronunciation: null,
    },
    elevenlabs: {
      success: Boolean(results.elevenlabs),
      filename: results.elevenlabs ? "elevenlabs-speech.mp3" : null,
      sizeKB: null,
      naturalness: null,
      clarity: null,
      pronunciation: null,
    },
  };

  if (results.openai) {
    const info = await stat(results.openai);
    comparison.openai.sizeKB = Math.round(info.size / 1024);
  }

  if (results.elevenlabs) {
    const info = await stat(results.elevenlabs);
    comparison.elevenlabs.sizeKB = Math.round(info.size / 1024);
  }

  console.table({
    OpenAI: {
      status: comparison.openai.success ? "Success" : "Failed",
      sizeKB: comparison.openai.sizeKB,
    },
    ElevenLabs: {
      status: comparison.elevenlabs.success ? "Success" : "Failed",
      sizeKB: comparison.elevenlabs.sizeKB,
    },
  });

  await saveText("comparison.json", JSON.stringify(comparison, null, 2));
}

// Main application
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in .env");
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log("\n=== VOICE-POWERED CONTENT CREATOR ===\n");

  const audioPath = (await rl.question("Enter audio file path: "))
    .trim()
    .replace(/^["']|["']$/g, "");

  if (!audioPath) {
    throw new Error("Audio file path is required.");
  }

  const fullPath = path.resolve(audioPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Audio file not found: ${fullPath}`);
  }

  // Transcribe
  const transcript = await transcribeAudio(fullPath);

  // Summarize
  const summary = await summarizeContent(transcript);

  // Enhance
  const enhanced = await enhanceContent(transcript);

  console.log("\n=== SUMMARY ===\n", summary);
  console.log("\n=== ENHANCED TEXT ===\n", enhanced);

  const results = {
    openai: null,
    elevenlabs: null,
  };

  // Generate OpenAI speech
  try {
    results.openai = await generateOpenAISpeech(enhanced);
  } catch (error) {
    console.error("OpenAI TTS failed:", error.message);
  }

  // Generate ElevenLabs speech
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error("Missing ELEVENLABS_API_KEY");
    }

    results.elevenlabs = await generateElevenLabsSpeech(enhanced);
  } catch (error) {
    console.error("ElevenLabs TTS failed:", error.message);
  }

  await compareSpeech(results);

  console.log("\nFinished!");
  console.log("Output folder:", OUTPUT_DIR);
}

main().catch((error) => {
  console.error("\n❌ ERROR DETAILS");
  console.error("Message:", error.message);
  console.error("Status:", error.status ?? "N/A");
  console.error("Code:", error.code ?? "N/A");
  console.error("Cause:", error.cause ?? "N/A");
  console.error("Stack:", error.stack);
});
