import "dotenv/config";
import path from "path";
import fs from "fs";
import os from "os";
import { Worker, Job } from "bullmq";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { spawn } from "child_process";
import fetch from "node-fetch";
import { s3, RAW_BUCKET, HLS_BUCKET } from "../services/s3";
import { db } from "../db/client";
import { connection } from "../services/queue";

interface SubtitleJob {
  videoId: string;
  s3Key: string;
}

function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", videoPath,
      "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k",
      "-y", audioPath,
    ]);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error("ffmpeg exited with " + code))
    );
  });
}

function segmentsToVTT(words: { start: number; end: number; text: string }[]): string {
  function fmt(ms: number): string {
    const t = ms / 1000;
    const h = Math.floor(t / 3600).toString().padStart(2, "0");
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    const msStr = Math.round(t % 1 * 1000).toString().padStart(3, "0");
    return h + ":" + m + ":" + s + "." + msStr;
  }

  // Group words into ~5 second chunks
  const segments: { start: number; end: number; text: string }[] = [];
  let current = { start: 0, end: 0, text: "" };

  for (const word of words) {
    if (!current.text) current.start = word.start;
    current.text += (current.text ? " " : "") + word.text;
    current.end = word.end;
    if ((word.end - current.start) > 5000) {
      segments.push({ ...current });
      current = { start: 0, end: 0, text: "" };
    }
  }
  if (current.text) segments.push(current);

  let vtt = "WEBVTT\n\n";
  segments.forEach((seg, i) => {
    vtt += (i + 1) + "\n";
    vtt += fmt(seg.start) + " --> " + fmt(seg.end) + "\n";
    vtt += seg.text.trim() + "\n\n";
  });
  return vtt;
}

async function transcribeWithAssemblyAI(audioPath: string): Promise<{ start: number; end: number; text: string }[]> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY!;

  // 1. Upload audio file to AssemblyAI
  console.log("  📤 Uploading audio to AssemblyAI...");
  const audioData = fs.readFileSync(audioPath);
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/octet-stream" },
    body: audioData,
  });
  const { upload_url } = await uploadRes.json() as { upload_url: string };

  // 2. Submit transcription job
  console.log("  🤖 Submitting transcription job...");
  const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, word_boost: [] }),
  });
  const { id } = await submitRes.json() as { id: string };

  // 3. Poll until complete
  console.log("  ⏳ Waiting for transcription...");
  let attempts = 0;
  while (attempts++ < 60) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch("https://api.assemblyai.com/v2/transcript/" + id, {
      headers: { authorization: apiKey },
    });
    const data = await pollRes.json() as {
      status: string;
      words?: { start: number; end: number; text: string }[];
      error?: string;
    };

    if (data.status === "completed" && data.words) {
      console.log("  ✅ Transcription complete!");
      return data.words;
    }
    if (data.status === "error") throw new Error("AssemblyAI error: " + data.error);
    console.log("  ⏳ Status: " + data.status + "...");
  }
  throw new Error("AssemblyAI timed out");
}

const worker = new Worker<SubtitleJob>(
  "subtitles",
  async (job: Job<SubtitleJob>) => {
    const { videoId, s3Key } = job.data;
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sub-" + videoId + "-"));
    const videoPath = path.join(workDir, "input.mp4");
    const audioPath = path.join(workDir, "audio.mp3");

    console.log("\n📝 Starting subtitle generation: " + videoId);

    try {
      // Download video
      const { Body } = await s3.send(new GetObjectCommand({ Bucket: RAW_BUCKET, Key: s3Key }));
      if (!Body) throw new Error("Empty S3 body");
      await pipeline(Body as NodeJS.ReadableStream, createWriteStream(videoPath));

      // Extract audio
      console.log("  🎵 Extracting audio...");
      await extractAudio(videoPath, audioPath);

      if (!process.env.ASSEMBLYAI_API_KEY) {
        console.log("  ℹ️  No AssemblyAI key — skipping subtitles");
        return;
      }

      // Transcribe
      const words = await transcribeWithAssemblyAI(audioPath);
      if (words.length === 0) { console.log("  ℹ️  No speech detected"); return; }

      // Convert to VTT and upload
      const vttContent = segmentsToVTT(words);
      const vttKey = "videos/" + videoId + "/subtitles/en.vtt";

      await s3.send(new PutObjectCommand({
        Bucket: HLS_BUCKET, Key: vttKey,
        Body: vttContent, ContentType: "text/vtt",
      }));

      await db.query(
        "INSERT INTO subtitles (video_id, language, vtt_s3_key) VALUES ($1, 'en', $2) ON CONFLICT DO NOTHING",
        [videoId, vttKey]
      );

      console.log("✅ Subtitles saved: " + vttKey + "\n");
    } catch (err) {
      console.error("❌ Subtitle generation failed:", err);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },
  { connection, concurrency: 1 }
);

console.log("🚀 Subtitle worker started — waiting for jobs...");