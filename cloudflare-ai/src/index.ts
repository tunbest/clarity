export interface Env {
  CLARITY_AI_SECRET: string;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<any>;
  };
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const MODEL = "@cf/zai-org/glm-4.7-flash";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", provider: "cloudflare-workers-ai", model: MODEL });
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat") {
      return json({ error: "Not found" }, 404);
    }
    if (!env.CLARITY_AI_SECRET || request.headers.get("authorization") !== `Bearer ${env.CLARITY_AI_SECRET}`) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!env.AI) {
      console.error("Cloudflare Workers AI binding is missing.");
      return json({ error: "Cloudflare Workers AI is not configured." }, 503);
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

    const conversation = messages.map((m) => ({ role: m.role, content: m.content }));
    if (!conversation.some((m) => m.role === "user")) {
      return json({ error: "A user message is required." }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await Promise.race([
        env.AI.run(MODEL, {
          messages: conversation,
          max_tokens: Math.min(1536, Math.max(128, Number(body.max_tokens ?? 900))),
          temperature: 0.2,
        }),
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("AI_TIMEOUT")), { once: true });
        }),
      ]);

      const response = typeof result === "string"
        ? result
        : typeof result?.response === "string"
          ? result.response
          : typeof result?.output_text === "string"
            ? result.output_text
            : "";
      if (!response.trim()) {
        console.error("Workers AI returned an empty response", {
          resultKeys: result && typeof result === "object" ? Object.keys(result).slice(0, 10) : [],
        });
        return json({ error: "Cloudflare Workers AI returned no text." }, 502);
      }
      return json({ success: true, model: MODEL, provider: "cloudflare-workers-ai", response: response.trim() });
    } catch (error: any) {
      const timedOut = error?.message === "AI_TIMEOUT";
      console.error("Workers AI inference failed", { name: error?.name || "unknown", timedOut });
      return json({ error: timedOut ? "Cloudflare AI request timed out." : "Cloudflare AI temporarily unavailable." }, timedOut ? 504 : 503);
    } finally {
      clearTimeout(timeout);
    }
  },
};
