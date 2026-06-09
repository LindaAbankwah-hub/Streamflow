import "dotenv/config";
import { Router, Request, Response } from "express";
import multer from "multer";
import { s3, RAW_BUCKET } from "../services/s3";
import { db } from "../db/client";
import { enqueueTranscode } from "../services/queue";
import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = [".mp4", ".mov", ".mkv", ".avi", ".m4v", ".webm"];
    const ext = "." + file.originalname.split(".").pop()?.toLowerCase();
    if (allowedExtensions.includes(ext) || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed (mp4, mov, mkv, avi, m4v, webm)"));
    }
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  "/",
  upload.single("video"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = null;
      const title = (req.body.title as string) ?? file.originalname;
      const description = (req.body.description as string) ?? "";

      // Upload to S3 manually
      const ext = file.originalname.split(".").pop();
      const s3Key = `raw/${uuidv4()}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: RAW_BUCKET,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO videos (user_id, title, description, raw_s3_key, status)
         VALUES ($1, $2, $3, $4, 'uploading')
         RETURNING id`,
        [userId, title, description, s3Key]
      );

      const videoId = rows[0].id;

      await enqueueTranscode({ videoId, s3Key, title });
      await db.query(
        `UPDATE videos SET status = 'processing' WHERE id = $1`,
        [videoId]
      );

      console.log(`✅ Upload received: ${videoId} — "${title}"`);
      res.json({ videoId, status: "processing" });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: String(err) });
    }
  }
);