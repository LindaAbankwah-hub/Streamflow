import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

export const transcodeQueue = new Queue("transcode", { connection });
export const subtitleQueue  = new Queue("subtitles",  { connection });

export interface TranscodeJob {
  videoId: string;
  s3Key:   string;
  title:   string;
}

export interface SubtitleJob {
  videoId: string;
  s3Key:   string;
}

export async function enqueueTranscode(data: TranscodeJob) {
  await transcodeQueue.add("transcode", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  console.log(`📥 Enqueued transcode job for video ${data.videoId}`);
}

export async function enqueueSubtitle(data: SubtitleJob) {
  await subtitleQueue.add("subtitle", data, { attempts: 2 });
  console.log(`📥 Enqueued subtitle job for video ${data.videoId}`);
}
