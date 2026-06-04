# API Key Usage Map

## AI Providers

| Key(s) | Used For | Provider | Rotation |
|--------|----------|----------|----------|
| `CEREBRAS_API_KEY` + `CEREBRAS_MODEL` | Email sync — extracting job updates from Gmail/Nylas emails | Cerebras (`llama3.1-8b`) | Single key |
| `OPENROUTER_API_KEY_1` / `_2` | Resume parsing, JD matching, resume generation, cover letters, job scraping | OpenRouter (`openai/gpt-oss-120b:free`) | ✅ 2 keys |
| `GROQ_API_KEY_1` / `_2` / `_3` | Fallback AI provider for matching, email gen, scoring | Groq (`llama-3.3-70b-versatile`) | ⚠️ 3 slots (must be unique) |
| `GEMINI_API_KEY` | Fallback AI provider | Google Gemini (`gemini-2.0-flash`) | Single key |
| `HF_TOKEN` | Last-resort fallback AI provider | HuggingFace | Single key |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | Optional — Claude 3.5 Sonnet for resume generation | AWS Bedrock | Single key |

**Failover chain:** Preferred provider → OpenRouter → Groq → Cerebras → Gemini → HuggingFace

## Job Search APIs

| Key(s) | Used For | Provider |
|--------|----------|----------|
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Aggregated job search | Adzuna API |
| `RAPIDAPI_KEY_1..5` + `RAPIDAPI_HOST_1..5` | LinkedIn, Indeed, Glassdoor, ActiveJobs, Google Jobs | RapidAPI (5 hosts, same key works) |
| `TAVILY_API_KEY_1` / `_2` | Premium URL scraping fallback | Tavily — ✅ 2-key rotation |
| `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX` | Google Custom Search for supplemental jobs | Google |
| `REMOTIVE_API` | Remote job listings (set to any value to enable) | Remotive (free, no key) |

## Automation — Auto Apply (Autopilot)

| Key(s) | Used For | Rotation |
|--------|----------|----------|
| `HUNTER_API_KEY` (or `HUNTER_API_KEY_1` / `_2` / `_3`) | Company HR email discovery from domain | ✅ Up to 3 keys |
| `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` | Sending application emails via Gmail SMTP | Single |

## Email Sync & Storage

| Key(s) | Used For |
|--------|----------|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth — Gmail sync + login |
| `NYLAS_API_KEY` + `NYLAS_CLIENT_ID` + `NYLAS_CLIENT_SECRET` | Nylas OAuth — backup email sync |
| `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | Resume PDF file storage |

## Auth

| Config | Used For |
|--------|----------|
| `NEXTAUTH_SECRET` | JWT session encryption |
| `GOOGLE_REDIRECT_URL` | OAuth callback URL override |

## Key Rotation Architecture

Keys with numbered variants (e.g. `TAVILY_API_KEY_1`, `TAVILY_API_KEY_2`) support automatic rotation:

```
getHunterKeys() → tries HUNTER_API_KEY_1, HUNTER_API_KEY_2, HUNTER_API_KEY_3 → HUNTER_API_KEY
getTavilyKeys() → tries TAVILY_API_KEY_1, TAVILY_API_KEY_2 → TAVILY_API_KEY
getGroqKeys()   → tries GROQ_API_KEY_1, GROQ_API_KEY_2, GROQ_API_KEY_3 → GROQ_API_KEY
getOpenRouterKeys() → tries OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2 → OPENROUTER_API_KEY
```

On 429 (rate limit), the system automatically tries the next key.
