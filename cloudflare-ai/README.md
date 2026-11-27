# Clarity AI — Cloudflare Workers AI

This Worker is the private AI inference gateway for Clarity PM. It is not exposed to browsers: Clarity's Express server calls it with a server-side bearer secret.

## Deploy

1. Install Wrangler locally: `bunx wrangler login`
2. From this directory, create the secret:
   `bunx wrangler secret put CLARITY_AI_SECRET`
   Use a random secret of at least 32 bytes. Configure the identical value as `CLOUDFLARE_AI_SECRET` in the Clarity production environment.
3. Deploy: `bunx wrangler deploy`
4. In Cloudflare DNS, make sure `ai.tfsn.dev` is available for the Worker custom domain. Wrangler will provision the route.

## Clarity server environment

```env
CLOUDFLARE_AI_URL=https://ai.tfsn.dev/v1/chat
CLOUDFLARE_AI_SECRET=<same-secret-as-worker>
```

Do not put either secret in Vite variables, frontend code, Git, or logs.

## Endpoint

`POST /v1/chat` accepts a JSON body with `messages` (system/user/assistant). Requests require the bearer secret. The Worker limits message count, message size, total prompt size, and output tokens.

## Free usage

Workers AI includes a daily free allocation (currently 10,000 Neurons/day on the Free plan). Model availability, quotas, and pricing can change; check the Cloudflare dashboard before production use. This Worker returns 503 on provider/quota failures and never fabricates a successful answer.

## Data handling

Only send the minimum project information needed for the task. Do not send passwords, session cookies, personal data, or confidential production data unless your organization has approved the processing and applicable contractual/privacy terms. The Worker does not persist prompts itself; Cloudflare's service-level processing and logging terms still apply.
