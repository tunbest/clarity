interface AiBinding { run(model: string, inputs: Record<string, unknown>): Promise<unknown>; }

export interface Env {
  AI: AiBinding;
  CLARITY_AI_SECRET: string;
  AI_MODEL?: string;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", provider: "cloudflare-workers-ai" });
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat") {
      return json({ error: "Not found" }, 404);
    }
    if (!env.CLARITY_AI_SECRET || request.headers.get("authorization") !== `Bearer ${env.CLARITY_AI_SECRET}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body: { messages?: ChatMessage[]; temperature?: number; max_tokens?: number };
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20 ||
        messages.some((m) => !m || !["system", "user", "assistant"].includes(m.role) ||
          typeof m.content !== "string" || !m.content.trim() || m.content.length > 12000)) {
      return json({ error: "Invalid messages: 1 to 20 messages, max 12,000 characters each." }, 400);
    }
    const totalChars = messages.reduce((n, m) => n + m.content.length, 0);
    if (totalChars > 30000) return json({ error: "Prompt too large." }, 413);

    try {
      const result = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", {
        messages,
        temperature: Math.min(1, Math.max(0, Number(body.temperature ?? 0.2))),
        max_tokens: Math.min(1800, Math.max(100, Number(body.max_tokens ?? 1200))),
      });
      const response = typeof result === "string" ? result :
        (result as any)?.response || (result as any)?.result || "";
      if (!response) return json({ error: "The AI provider returned an empty response." }, 502);
      return json({ success: true, model: env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", response });
    } catch (error) {
      console.error("Workers AI invocation failed", error);
      return json({ error: "AI temporarily unavailable. Please retry later." }, 503);
    }
  },
};
