import "dotenv/config";
import path from "path";
import fs from "fs";
import os from "os";
import { Worker, Job } from "bullmq";
import ffmpeg from "fluent-ffmpeg";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { s3, RAW_BUCKET, HLS_BUCKET, CDN_BASE } from "../services/s3";
import { db } from "../db/client";
import { connection, enqueueSubtitle, TranscodeJob } from "../services/queue";

const RENDITIONS = [
  { name: "360p",  width: 640,  height: 360,  videoBitrate: "800k",  audioBitrate: "96k"  },
  { name: "720p",  width: 1280, height: 720,  videoBitrate: "2500k", audioBitrate: "128k" },
  { name: "1080p", width: 1920, height: 1080, videoBitrate: "5000k", audioBitrate: "192k" },
];

async function downloadFromS3(key: string, localPath: string): Promise<void> {
  const { Body } = await s3.send(
    new GetObjectCommand({ Bucket: RAW_BUCKET, Key: key })
  );
  if (!Body) throw new Error("Empty body from S3");
  await pipeline(Body as NodeJS.ReadableStream, createWriteStream(localPath));
}

async function uploadFileToS3(localPath: string, s3Key: string, contentType: string): Promise<void> {
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({ Bucket: HLS_BUCKET, Key: s3Key, Body: body, ContentType: contentType }));
}

async function uploadDirectoryToS3(localDir: string, s3Prefix: string): Promise<void> {
  if (!fs.existsSync(localDir)) return;
  const files = fs.readdirSync(localDir);
  await Promise.all(
    files.map((file) => {
      const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      return uploadFileToS3(path.join(localDir, file), `${s3Prefix}/${file}`, contentType);
    })
  );
}

function probeVideo(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      const vs = meta.streams.find((s) => s.codec_type === "video");
      resolve({ duration: meta.format.duration ?? 0, width: vs?.width ?? 1920, height: vs?.height ?? 1080 });
    });
  });
}

function transcodeToHLS(inputPath: string, outputDir: string, rendition: typeof RENDITIONS[0], sourceHeight: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (rendition.height > sourceHeight) {
      fs.mkdirSync(outputDir, { recursive: true });
      return resolve();
    }
    fs.mkdirSync(outputDir, { recursive: true });
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264", "-c:a aac",
        `-b:v ${rendition.videoBitrate}`, `-b:a ${rendition.audioBitrate}`,
        `-vf scale=-2:${rendition.height}`,
        "-profile:v main", "-preset fast", "-crf 23",
        "-g 48", "-keyint_min 48", "-sc_threshold 0",
        "-hls_time 2", "-hls_playlist_type vod",
        `-hls_segment_filename ${outputDir}/seg%03d.ts`,
      ])
      .output(`${outputDir}/index.m3u8`)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

function buildMasterPlaylist(): string {
  let m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n\n";
  for (const r of RENDITIONS) {
    const bandwidth = parseInt(r.videoBitrate) * 1000;
    m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.name}"\n`;
    m3u8 += `${r.name}/index.m3u8\n\n`;
  }
  return m3u8;
}

const worker = new Worker<TranscodeJob>(
  "transcode",
  async (job: Job<TranscodeJob>) => {
    const { videoId, s3Key } = job.data;
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `vid-${videoId}-`));
    const inputPath = path.join(workDir, "input.mp4");

    console.log(`\n🎬 Starting transcode: ${videoId}`);

    try {
      console.log("  ⬇ Downloading from S3...");
      await job.updateProgress(5);
      await downloadFromS3(s3Key, inputPath);

      const { duration, height } = await probeVideo(inputPath);
      console.log(`  📐 duration: ${Math.round(duration)}s`);
      await job.updateProgress(10);

      // Generate thumbnail
      const thumbPath = path.join(workDir, "thumb.jpg");
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({ timestamps: ["10%"], filename: "thumb.jpg", folder: workDir, size: "640x?" })
          .on("end", () => resolve())
          .on("error", (err) => reject(err));
      });

      const thumbKey = `thumbs/${videoId}.jpg`;
      await uploadFileToS3(thumbPath, thumbKey, "image/jpeg");
      await job.updateProgress(15);

      // Transcode each rendition
      let progress = 15;
      const progressPerRendition = 65 / RENDITIONS.length;

      for (const rendition of RENDITIONS) {
        console.log(`  🔄 Encoding ${rendition.name}...`);
        const outDir = path.join(workDir, rendition.name);
        await transcodeToHLS(inputPath, outDir, rendition, height);
        progress += progressPerRendition;
        await job.updateProgress(Math.floor(progress));
        console.log(`  ✅ ${rendition.name} done`);
      }

      // Upload segments
      console.log("  ⬆ Uploading to S3...");
      for (const rendition of RENDITIONS) {
        await uploadDirectoryToS3(path.join(workDir, rendition.name), `videos/${videoId}/${rendition.name}`);
      }
      await job.updateProgress(90);

      // Upload master playlist
      const masterContent = buildMasterPlaylist();
      await s3.send(new PutObjectCommand({
        Bucket: HLS_BUCKET, Key: `videos/${videoId}/master.m3u8`,
        Body: masterContent, ContentType: "application/vnd.apple.mpegurl",
      }));

      // Update database
      const thumbnailUrl = `${CDN_BASE}/thumbs/${videoId}.jpg`;
      await db.query(
        `UPDATE videos SET status = 'ready', duration_secs = $1, thumbnail_url = $2 WHERE id = $3`,
        [Math.floor(duration), thumbnailUrl, videoId]
      );

      for (const r of RENDITIONS) {
        await db.query(
          `INSERT INTO video_renditions (video_id, quality, playlist_key, bandwidth, width, height)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
          [videoId, r.name, `videos/${videoId}/${r.name}/index.m3u8`, parseInt(r.videoBitrate) * 1000, r.width, r.height]
        );
      }

      await enqueueSubtitle({ videoId, s3Key });
      await job.updateProgress(100);
      console.log(`✅ Transcode complete: ${videoId}\n`);
    } catch (err) {
      console.error(`❌ Transcode failed: ${videoId}`, err);
      throw err;
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },
  { connection, concurrency: 2 }
);

worker.on("failed", async (job, err) => {
  if (!job) return;
  await db.query(`UPDATE videos SET status = 'failed' WHERE id = $1`, [job.data.videoId]).catch(console.error);
});

console.log("🚀 Transcode worker started — waiting for jobs...");