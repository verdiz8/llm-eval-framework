/**
 * OpenAI-compatible chat completions provider.
 *
 * Calls any endpoint that speaks the OpenAI /v1/chat/completions format
 * (OpenAI, Groq, Together, local Ollama, etc.) and returns the parsed response.
 */

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call an OpenAI-compatible chat completions endpoint and return the text content.
 * Attempts to parse the response as JSON if possible.
 */
export async function callOpenAICompatible(
  prompt: string,
  config: OpenAIConfig
): Promise<unknown> {
  // Normalize endpoint: ensure it ends with /chat/completions
  let url = config.endpoint;
  if (!url.endsWith("/chat/completions")) {
    url = url.replace(/\/$/, "") + "/chat/completions";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenAI-compatible API error ${response.status}: ${errorBody.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  const textContent = data.choices?.[0]?.message?.content ?? "";

  // Try to parse as JSON — LLMs often return JSON in text blocks
  try {
    return JSON.parse(textContent);
  } catch {
    return textContent;
  }
}
