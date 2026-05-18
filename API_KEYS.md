# API Key Usage Map

## AI Providers

| API Key | Used For | Provider |
|---------|----------|----------|
| `CEREBRAS_API_KEY` | Email sync — extracting job updates from Gmail/Nylas emails | Cerebras (`llama3.1-8b`) |
| `OPENROUTER_API_KEY` | Resume parsing, JD matching, resume generation, cover letters, job scraping | OpenRouter (`openai/gpt-oss-120b:free`) |
| `GROQ_API_KEY` | Fallback AI provider (if OpenRouter fails) | Groq (`llama-3.3-70b-versatile`) |
| `GEMINI_API_KEY` | Fallback AI provider | Google Gemini (`gemini-2.0-flash`) |
| `HF_TOKEN` | Fallback AI provider | HuggingFace |

## Job Search

| API Key | Used For | Provider |
|---------|----------|----------|
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Aggregated job search | Adzuna API |
| `RAPIDAPI_KEY` | JSearch job board aggregation | RapidAPI / JSearch |
| `TAVILY_API_KEY` | Web search for jobs + fallback URL scraping | Tavily |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` | Google Custom Search for jobs | Google |
| `REMOTIVE_API` | Remote job listings (public API, no key) | Remotive |

## Storage & Automation

| API Key | Used For | Provider |
|---------|----------|----------|
| `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | Resume file uploads/storage | Cloudinary |
| `NYLAS_API_KEY` | Email integration (OAuth + webhook sync) | Nylas |
| `NYLAS_CLIENT_ID` + `NYLAS_CLIENT_SECRET` | Nylas OAuth flow + webhook verification | Nylas |

## Authentication

| Config | Used For | Provider |
|--------|----------|----------|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth login + Gmail API access | Google |
| `NEXTAUTH_SECRET` | Session encryption | NextAuth |
| `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` | Email verification emails | Gmail SMTP |

## Failover Order (AI)

When a feature calls an AI provider, the system tries providers in this order:

1. **Dedicated provider** (e.g., Cerebras for email sync)
2. **Configured provider** from `activeAIProvider` setting
3. All other providers with configured keys (automatic cascade)
4. Keyword/rules-based fallback (no API key needed)
