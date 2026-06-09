import "dotenv/config";
import { Router } from "express";
import { db } from "../db/client";
import { CDN_BASE } from "../services/s3";

export const videosRouter = Router();

videosRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT v.id, v.title, v.description, v.thumbnail_url,
              v.duration_secs, v.status, v.created_at,
              u.name AS author,
              COUNT(DISTINCT w.session_id) AS views
       FROM videos v
       LEFT JOIN users u ON u.id = v.user_id
       LEFT JOIN watch_events w ON w.video_id = v.id
       WHERE v.status = 'ready'
       GROUP BY v.id, u.name
       ORDER BY v.created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

videosRouter.get("/:id", async (req, res) => {
  try {
    const { rows: [video] } = await db.query(
      `SELECT * FROM videos WHERE id = $1`,
      [req.params.id]
    );
    if (!video) return res.status(404).json({ error: "Video not found" });

    const { rows: renditions } = await db.query(
      `SELECT * FROM video_renditions WHERE video_id = $1 ORDER BY bandwidth ASC`,
      [req.params.id]
    );

    const { rows: subs } = await db.query(
      `SELECT * FROM subtitles WHERE video_id = $1`,
      [req.params.id]
    );

    const masterUrl = `${CDN_BASE}/videos/${video.id}/master.m3u8`;
    const subtitleUrl = subs[0] ? `${CDN_BASE}/${subs[0].vtt_s3_key}` : null;

    res.json({ ...video, masterUrl, renditions, subtitleUrl });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

videosRouter.get("/:id/status", async (req, res) => {
  try {
    const { rows: [video] } = await db.query(
      `SELECT id, status FROM videos WHERE id = $1`,
      [req.params.id]
    );
    if (!video) return res.status(404).json({ error: "Video not found" });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

videosRouter.delete("/:id", async (req, res) => {
  try {
    await db.query(`DELETE FROM videos WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});