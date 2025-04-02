**Features**

- Chat interface styled like ChatGPT with light/dark theme elements.

- Supports OpenAI and Workers AI models with configurable providers.

- Responsive design with sidebar toggle for mobile devices.

- Markdown-to-HTML conversion for rich text responses.

- Deployed on Cloudflare Workers for low-latency, serverless execution.

**Prerequisites**

- A Cloudflare account with Workers enabled.

- Wrangler CLI installed (npm install -g wrangler).

- API keys for OpenAI and/or Cloudflare Workers AI.

**Create a .dev.vars file in the root directory or use the Cloudflare dashboard to set these secrets:
**

OPENAI_TOKEN=your-openai-api-key
WORKERSAI_TOKEN=your-workers-ai-api-key
ACCOUNT_ID=your-cloudflare-account-id
GATEWAY_NAME=your-ai-gateway-name
AI_GATEWAY_TOKEN=your-ai-gateway-token

**Alternatively, use Wrangler to set secrets
**

wrangler secret put OPENAI_TOKEN
wrangler secret put WORKERSAI_TOKEN
wrangler secret put ACCOUNT_ID
wrangler secret put GATEWAY_NAME
wrangler secret put AI_GATEWAY_TOKEN

**Troubleshooting**
API Errors: Ensure all environment variables are correctly set and API keys have the necessary permissions (e.g., model.request for OpenAI).

UI Issues: Check browser console logs for JavaScript errors or test responsiveness with DevTools.

Deployment Fails: Verify Wrangler is authenticated and your Cloudflare account has Workers access.

