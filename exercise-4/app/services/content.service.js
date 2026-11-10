import { openai } from "../config/openai.js";
import { withRetry } from "../utils/retry.js";

const model = process.env.TEXT_MODEL || "gpt-4.1-mini";

async function generate(prompt) {
  const response = await withRetry(() =>
    openai.responses.create({
      model,
      input: prompt,
    }),
  );

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("AI returned empty content");
  }

  return text;
}

export async function generateArticle(topic, language) {
  return generate(`
    Write a professional article about: ${topic}

    Language: ${language}

    Requirements:
    - Engaging title
    - Strong introduction
    - 4 to 5 sections
    - Practical examples
    - Clear conclusion
    - 500 to 700 words
    - Markdown format

    Avoid fabricated facts and statistics.
  `);
}

export async function generateSummary(article, language) {
  return generate(`
    Summarize this article in ${language}.
    Use 100 to 150 words.
    Preserve the important ideas.

    ARTICLE:
    ${article}
  `);
}

export async function generateSocialPosts(article, language) {
  return generate(`
    Create three social media posts based on
    the article below.

    Language: ${language}

    1. LinkedIn: professional and engaging
    2. Facebook: friendly and informative
    3. X: maximum 280 characters

    Include suitable hashtags.

    ARTICLE:
    ${article}
  `);
}
