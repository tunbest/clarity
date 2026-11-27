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
      const result = await env.AI.run(env.AI_MODEL || "@cf/zai-org/glm-4.7-flash", {
        messages,
        temperature: Math.min(1, Math.max(0, Number(body.temperature ?? 0.2))),
        max_tokens: Math.min(1800, Math.max(100, Number(body.max_tokens ?? 1200))),
      });
      const output: any = result as any;
      const choice = output?.choices?.[0];
      const message = choice?.message;
      const asText = (value: any): string => {
        if (typeof value === "string") return value.trim();
        if (Array.isArray(value)) {
          return value.map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part.text === "string") return part.text;
            return "";
          }).join("").trim();
        }
        return "";
      };
      const candidates = [
        asText(result),
        asText(output?.response),
        asText(output?.result),
        asText(output?.content),
        asText(output?.output_text),
        asText(choice?.text),
        asText(message?.content),
        asText(choice?.delta?.content),
        asText(output?.result?.response),
        asText(output?.result?.content),
      ];
      const response = candidates.find((value) => value.length > 0);
      if (!response) {
        // Log only response shape metadata; never log prompts, credentials, or generated content.
        console.error("Workers AI returned no text content", {
          resultType: typeof result,
          resultKeys: output && typeof output === "object" ? Object.keys(output).slice(0, 20) : [],
          choiceKeys: choice && typeof choice === "object" ? Object.keys(choice).slice(0, 20) : [],
          messageKeys: message && typeof message === "object" ? Object.keys(message).slice(0, 20) : [],
          contentType: typeof message?.content,
          contentIsArray: Array.isArray(message?.content),
        });
        return json({
          error: "Workers AI returned no text content.",
          resultType: typeof result,
          resultKeys: output && typeof output === "object" ? Object.keys(output).slice(0, 20) : [],
          choiceKeys: choice && typeof choice === "object" ? Object.keys(choice).slice(0, 20) : [],
          messageKeys: message && typeof message === "object" ? Object.keys(message).slice(0, 20) : [],
          contentType: typeof message?.content,
          contentIsArray: Array.isArray(message?.content),
        }, 502);
      }
      return json({ success: true, model: env.AI_MODEL || "@cf/zai-org/glm-4.7-flash", response });
    } catch (error) {
      console.error("Workers AI invocation failed", error);
      return json({ error: "AI temporarily unavailable. Please retry later." }, 503);
    }
  },
};
