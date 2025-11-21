# Inbound

Automated lead qualification and response system using Next.js 15, Firestore, and AI.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

You'll need:
- **OpenAI API Key**: Get from https://platform.openai.com/api-keys
- **Firebase Project**: Create at https://console.firebase.google.com/

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the customer view and [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the SDR dashboard.

## Demo Experience

1. Open `http://localhost:3000/` in one browser tab (customer view)
2. Open `http://localhost:3000/dashboard` in another tab (SDR dashboard)
3. Position them side-by-side
4. Submit a lead on the customer page → see it appear in the dashboard via real-time Firestore sync

## Architecture

- **Customer Page** (`/`): Public-facing lead submission form
- **SDR Dashboard** (`/dashboard`): Internal review queue, sent emails, and documentation
- **API Routes** (`/api/leads/*`): Handle lead submission, AI classification, and email generation
- **Firestore**: Real-time database for lead storage and sync
- **Vercel AI SDK**: LLM integration for classification and email generation

## Project Structure

```
/app
  /page.tsx                 # Customer lead form
  /dashboard/page.tsx       # SDR dashboard
  /api/leads/*              # API endpoints
  /components               # React components
/lib                        # Utilities, types, Firestore config
```

See [PLAN.md](../PLAN.md) for complete implementation details.
