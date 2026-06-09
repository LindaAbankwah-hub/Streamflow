# StreamFlow — Complete Setup Instructions

## Step 1: Copy all files into your project

Your folder structure should look like this after copying:

streaming-platform/
├── docker-compose.yml
├── localstack-init.sh
├── backend/
│   ├── .env
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── db/
│       │   ├── client.ts
│       │   └── migrations/
│       │       └── 001_init.sql
│       ├── services/
│       │   ├── s3.ts
│       │   └── queue.ts
│       ├── routes/
│       │   ├── upload.ts
│       │   ├── videos.ts
│       │   ├── analytics.ts
│       │   └── recommendations.ts
│       └── workers/
│           ├── transcodeWorker.ts
│           └── subtitleWorker.ts
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        └── components/
            ├── HomePage.tsx
            ├── UploadPage.tsx
            ├── WatchPage.tsx
            ├── VideoPlayer.tsx
            └── AnalyticsDash.tsx

---

## Step 2: Install backend dependencies

Open a terminal and run:

  cd streaming-platform/backend
  npm install

---

## Step 3: Install frontend dependencies

Open a NEW terminal tab and run:

  cd streaming-platform/frontend
  npm install hls.js react-router-dom
  npm install -D @types/react @types/react-dom @vitejs/plugin-react vite typescript

---

## Step 4: Start Docker (Postgres + Redis + fake S3)

Open a NEW terminal tab in the streaming-platform root folder and run:

  docker-compose up -d

Wait about 30 seconds for everything to start, then check it worked:

  docker ps

You should see postgres, redis, and localstack running.

---

## Step 5: Run the database migration

  docker exec -i streaming-platform-postgres-1 psql -U stream -d streamdb < backend/src/db/migrations/001_init.sql

If that command name doesn't work, find your postgres container name with:
  docker ps
Then replace "streaming-platform-postgres-1" with the actual name.

---

## Step 6: Start the backend API

In your backend terminal:

  cd streaming-platform/backend
  npm run dev

You should see: "API running on http://localhost:4000"

---

## Step 7: Start the transcode worker

Open a NEW terminal tab:

  cd streaming-platform/backend
  npm run worker

You should see: "Transcode worker started — waiting for jobs..."

---

## Step 8: Start the subtitle worker (optional)

Open a NEW terminal tab:

  cd streaming-platform/backend
  npm run subtitle-worker

---

## Step 9: Start the frontend

In your frontend terminal:

  cd streaming-platform/frontend
  npm run dev

Then open http://localhost:5173 in your browser.

---

## You need 4 terminal tabs open at once:

  Tab 1: docker-compose up -d (run once)
  Tab 2: cd backend && npm run dev
  Tab 3: cd backend && npm run worker
  Tab 4: cd frontend && npm run dev

---

## Testing it works

1. Open http://localhost:5173
2. Click "Upload Video"
3. Pick any .mp4 file from your computer
4. Give it a title and click "Upload & Transcode"
5. Watch the status change from "uploading" → "processing" → "ready"
6. Click "Watch now" to open the player
7. Click "Stats" in the top-right of the player to see live bandwidth and quality

---

## Getting an OpenAI key (for subtitles)

1. Go to https://platform.openai.com
2. Sign up or log in
3. Click "API Keys" in the left sidebar
4. Click "Create new secret key"
5. Copy the key and paste it into backend/.env as OPENAI_API_KEY=sk-...

Without this key, everything still works — subtitles just won't be generated.
