import "dotenv/config";
import { Router } from "express";
import { db } from "../db/client";

export const recommendRouter = Router();

recommendRouter.get("/:userId", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) ?? "10");
    const { rows } = await db.query(
      `SELECT v.id, v.title, v.thumbnail_url, v.duration_secs
       FROM videos v
       WHERE v.status = 'ready'
       ORDER BY v.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ type: "popular", videos: rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});