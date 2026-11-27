# Clarity AI — Cloudflare Workers AI

This Worker is the private AI inference gateway for Clarity PM. It is not exposed to browsers: Clarity's Express server calls it with a server-side bearer secret.

## Automated deployment through GitHub Actions

The repository workflow `.github/workflows/deploy-cloudflare-ai.yml` deploys this Worker when changes to `cloudflare-ai/**` are pushed to `main`, or when manually started from the Actions tab.

Configure these repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with the minimum permissions required to deploy Workers and configure the custom domain.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID.
- `CLARITY_AI_SECRET`: a random secret of at least 32 bytes.

The workflow writes `CLARITY_AI_SECRET` to the Worker using Wrangler and deploys `ai.tfsn.dev`. Do not put secrets in source files, frontend variables, or logs.

## Clarity server environment

Configure these on the Clarity production server (Azure), not only in GitHub:

```env
CLOUDFLARE_AI_URL=https://ai.tfsn.dev/v1/chat
CLOUDFLARE_AI_SECRET=<same-value-as-GitHub-CLARITY_AI_SECRET>
```

Restart/redeploy the Clarity application after changing its server environment. The secret must match the Worker secret exactly.

## Model and free allocation

The default model is `@cf/zai-org/glm-4.7-flash`. Workers AI has a daily free allocation on eligible plans; quotas, model availability, and pricing can change, so check the Cloudflare dashboard before production use. The Worker returns an error on provider/quota failures and never fabricates a successful answer.

## Endpoint

`POST /v1/chat` accepts a JSON body with `messages` (system/user/assistant). Requests require the bearer secret. The Worker limits message count, message size, total prompt size, and output tokens.

## Data handling

Only send the minimum project information needed for the task. Do not send passwords, session cookies, personal data, or confidential production data unless your organization has approved the processing and applicable contractual/privacy terms. The Worker does not persist prompts itself; Cloudflare's service-level processing and logging terms still apply.
