# Tomobodo 🍜

A bilingual Kanban board with English/Japanese support, powered by LLM translation.

## Features

- **Trello-like Kanban board** with drag-and-drop
- **Bilingual cards** - English and Japanese side by side
- **LLM Translation** - Type in one language, auto-translate to the other
- **Comments** with user profiles
- **Attachments** - Upload images, files, or add links
- **Paste images** directly into cards
- **Archive** cards and columns
- **Google Authentication** via Firebase

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Drag & Drop**: @hello-pangea/dnd
- **Translation**: OpenAI GPT-4o-mini
- **Deployment**: Vercel

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/tomobodo.git
cd tomobodo
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/project/tomobodo)
2. Enable **Authentication** > **Google** sign-in provider
3. Enable **Cloud Storage** > Click "Get Started"
4. Your Firestore database is already configured

### 3. Environment Variables

Create a `.env.local` file (or configure in Vercel):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tomobodo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tomobodo
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tomobodo.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
OPENAI_API_KEY=your-openai-api-key
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Firebase Console Links

- [Authentication](https://console.firebase.google.com/project/tomobodo/authentication)
- [Firestore](https://console.firebase.google.com/project/tomobodo/firestore)
- [Storage](https://console.firebase.google.com/project/tomobodo/storage)

## License

MIT
