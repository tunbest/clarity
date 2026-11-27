export interface Env {
  CLARITY_AI_SECRET: string;
  ANTHROPIC_API_KEY: string;
  AI_MODEL?: string;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const MODEL = "claude-haiku-5-5";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", provider: "anthropic", model: MODEL });
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat") {
      return json({ error: "Not found" }, 404);
    }
    if (!env.CLARITY_AI_SECRET || request.headers.get("authorization") !== `Bearer ${env.CLARITY_AI_SECRET}`) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!env.ANTHROPIC_API_KEY) {
      console.error("Anthropic API key is not configured on the Worker.");
      return json({ error: "Anthropic provider is not configured." }, 503);
    }

    let body: { messages?: ChatMessage[]; max_tokens?: number };
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20 ||
        messages.some((m) => !m || !["system", "user", "assistant"].includes(m.role) ||
          typeof m.content !== "string" || !m.content.trim() || m.content.length > 12000)) {
      return json({ error: "Invalid messages: 1 to 20 messages, max 12,000 characters each." }, 400);
    }
    if (messages.reduce((n, m) => n + m.content.length, 0) > 30000) {
      return json({ error: "Prompt too large." }, 413);
    }

    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    if (!conversation.length || conversation[conversation.length - 1].role !== "user") {
      return json({ error: "A user message is required as the final message." }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: Math.min(2048, Math.max(128, Number(body.max_tokens ?? 1200))),
          ...(system ? { system } : {}),
          messages: conversation,
          output_config: { effort: "low" },
        }),
        signal: controller.signal,
      });

      const result: any = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error("Anthropic API request failed", {
          status: upstream.status,
          type: result?.error?.type || "unknown",
        });
        return json({
          error: "Anthropic API request failed.",
          upstreamStatus: upstream.status,
          upstreamType: result?.error?.type || "unknown",
        }, upstream.status === 429 ? 429 : upstream.status >= 500 ? 503 : 502);
      }

      const response = Array.isArray(result?.content)
        ? result.content.filter((part: any) => part?.type === "text" && typeof part.text === "string")
            .map((part: any) => part.text).join("").trim()
        : "";
      if (!response) {
        console.error("Anthropic returned no text content", {
          stopReason: result?.stop_reason || "unknown",
          contentTypes: Array.isArray(result?.content) ? result.content.map((part: any) => part?.type).slice(0, 10) : [],
        });
        return json({ error: "Anthropic returned no text content." }, 502);
      }
      return json({ success: true, model: MODEL, provider: "anthropic", response });
    } catch (error: any) {
      console.error("Anthropic request unavailable", { name: error?.name || "unknown" });
      return json({
        error: error?.name === "AbortError" ? "Anthropic request timed out." : "Anthropic temporarily unavailable.",
      }, error?.name === "AbortError" ? 504 : 503);
    } finally {
      clearTimeout(timeout);
    }
  },
};
