# VoicePost AI

> **Turn voice memos into polished LinkedIn posts — in seconds.**

A full-stack AI-powered content creation tool built with Next.js 14, featuring voice transcription, multi-provider LLM generation, LinkedIn OAuth, auto-publishing, and email draft notifications.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎙️ **Voice → Post** | Record a voice memo → AI transcribes, corrects, and rewrites it as a LinkedIn post |
| 🏷️ **Auto-Hashtags** | LLM enrichment pass guarantees 3–8 relevant hashtags, pre-filled in the editor |
| 🔗 **LinkedIn OAuth** | Connect your account, scrape your last 5 posts to learn your writing style |
| 🤖 **Writing Style DNA** | Learn from your own posts or choose from expert creator voice profiles |
| 📧 **Draft Email** | Sends a beautiful HTML email to you (via Resend) with post preview + "Review & Publish" link |
| ✅ **Approve & Publish** | One-tap publish directly to LinkedIn via `w_member_social` OAuth scope |
| 🎨 **Image Picker** | Search Unsplash, AI-generate (Flux), or upload your own |
| 🎠 **Carousel Builder** | _(coming)_ Define slide template → LLM generates 5–7 slides → post as LinkedIn document |
| 📱 **iOS PWA** | Mobile-first UI with dark mode, installable as a Progressive Web App |

---

## 🚀 Cloud Deployment

VoicePost AI is fully cloud-native, deployed on Vercel, and backed by Supabase Cloud.

### Deployment on Vercel

1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Configure the environment variables listed below in your Vercel project settings.
4. Deploy the application.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `ASSEMBLYAI_API_KEY` | ✅ | Voice transcription ([assemblyai.com](https://assemblyai.com)) |
| `NVIDIA_NIM_API_KEY` | ⚡ | Primary LLM provider ([build.nvidia.com](https://build.nvidia.com)) |
| `RESEND_API_KEY` | 📧 | Email notifications ([resend.com](https://resend.com) — free tier) |
| `RESEND_FROM_EMAIL` | 📧 | Sender address (e.g. `noreply@yourdomain.com`) |
| `NEXT_PUBLIC_APP_URL` | 📧 | Your deployment URL (for email deep links) |
| `LINKEDIN_CLIENT_ID` | 🔗 | LinkedIn OAuth app client ID |
| `LINKEDIN_CLIENT_SECRET` | 🔗 | LinkedIn OAuth app client secret |
| `LINKEDIN_REDIRECT_URI` | 🔗 | OAuth callback URL (e.g. `https://yourdomain.com/api/auth/linkedin/callback`) |

---

## 🏗️ Architecture

```
Voice Input → AssemblyAI Transcription → NVIDIA NIM / Groq LLM
     ↓
Post Generation → Hashtag Enrichment → Image Selection
     ↓
Approval Page → Resend Email Draft → LinkedIn Publish
```

### LLM Waterfall (automatic failover)
```
NVIDIA NIM (nemotron) → Groq (llama-3) → OpenAI (gpt-4o-mini)
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── content/generate/     # Post generation + hashtag enrichment
│   │   ├── voice/transcribe/     # AssemblyAI transcription
│   │   ├── linkedin/scrape-posts/ # Scrape user's last 5 LinkedIn posts
│   │   ├── notify/email/         # Resend email draft notifications
│   │   ├── posts/[id]/publish/   # LinkedIn UGC post publishing
│   │   └── auth/linkedin/        # OAuth flow
│   ├── posts/new/                # Create post (voice + style + image)
│   ├── posts/[id]/approval/      # Review, edit, publish
│   └── settings/linkedin/        # LinkedIn connection management
└── lib/
    ├── llm/router.ts             # Multi-provider LLM routing
    ├── providers/registry.ts     # Provider configurations
    └── agents/antigravity.ts     # Antigravity AI agent wrapper
```

---

## 📜 License

MIT — build on it, ship it, make it yours.
