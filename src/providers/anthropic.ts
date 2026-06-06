/**
 * Anthropic Messages API provider.
 *
 * Calls the Anthropic API (https://api.anthropic.com/v1/messages)
 * with a single user message and returns the parsed text response.
 */

export interface AnthropicConfig {
  apiKey: string;
  model: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
}

/**
 * Call the Anthropic Messages API and return the text content.
 * Attempts to parse the response as JSON if possible.
 */
export async function callAnthropic(
  prompt: string,
  config: AnthropicConfig
): Promise<unknown> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Anthropic API error ${response.status}: ${errorBody.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as AnthropicResponse;

  const textContent =
    data.content.find((c) => c.type === "text")?.text ?? "";

  // Try to parse as JSON — LLMs often return JSON in text blocks
  try {
    return JSON.parse(textContent);
  } catch {
    return textContent;
  }
}
