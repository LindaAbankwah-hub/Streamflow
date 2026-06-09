import { Router } from "express";
import { db } from "../db/client";

export const analyticsRouter = Router();

// Ingest a player event (play, pause, seek, heartbeat, quality_change, ended)
analyticsRouter.post("/event", async (req, res) => {
  try {
    const {
      videoId,
      userId,
      sessionId,
      positionSecs,
      quality,
      bandwidthKbps,
      eventType,
    } = req.body;

    await db.query(
      `INSERT INTO watch_events
         (video_id, session_id, position_secs, quality, bandwidth_kbps, event_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [videoId, sessionId, positionSecs, quality, bandwidthKbps, eventType]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get analytics for a specific video
analyticsRouter.get("/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    const { rows: [summary] } = await db.query(
      `SELECT
         COUNT(DISTINCT session_id) AS total_views,
         AVG(position_secs)         AS avg_position
       FROM watch_events
       WHERE video_id = $1 AND event_type = 'heartbeat'`,
      [videoId]
    );

    const { rows: [vidInfo] } = await db.query(
      `SELECT duration_secs FROM videos WHERE id = $1`,
      [videoId]
    );

    // Build drop-off curve: what % of viewers are still watching at each 10% interval
    const { rows: buckets } = await db.query(
      `WITH sessions AS (
         SELECT session_id, MAX(position_secs) AS max_pos
         FROM watch_events
         WHERE video_id = $1
         GROUP BY session_id
       )
       SELECT
         bucket,
         ROUND(
           COUNT(*) FILTER (WHERE max_pos >= (bucket * $2 / 10.0))
           * 100.0 / NULLIF(COUNT(*), 0)
         ) AS pct_retained
       FROM sessions, generate_series(0, 9) AS bucket
       GROUP BY bucket
       ORDER BY bucket`,
      [videoId, vidInfo?.duration_secs ?? 60]
    );

    // Quality distribution
    const { rows: qualityDist } = await db.query(
      `SELECT quality, COUNT(*) AS count
       FROM watch_events
       WHERE video_id = $1 AND event_type = 'heartbeat'
       GROUP BY quality
       ORDER BY quality`,
      [videoId]
    );

    // Average bandwidth by time bucket
    const { rows: bandwidthOverTime } = await db.query(
      `SELECT
         FLOOR(position_secs / 30) AS bucket_30s,
         ROUND(AVG(bandwidth_kbps)) AS avg_bandwidth
       FROM watch_events
       WHERE video_id = $1 AND bandwidth_kbps > 0
       GROUP BY bucket_30s
       ORDER BY bucket_30s`,
      [videoId]
    );

    res.json({
      totalViews:       parseInt(summary?.total_views ?? "0"),
      avgPositionSecs:  parseFloat(summary?.avg_position ?? "0"),
      durationSecs:     vidInfo?.duration_secs ?? 0,
      dropOffCurve:     buckets,
      qualityDist,
      bandwidthOverTime,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Global dashboard analytics
analyticsRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         v.id, v.title, v.thumbnail_url, v.duration_secs,
         COUNT(DISTINCT w.session_id) AS views,
         ROUND(AVG(w.position_secs)::numeric, 1) AS avg_watch_secs
       FROM videos v
       LEFT JOIN watch_events w ON w.video_id = v.id AND w.event_type = 'heartbeat'
       WHERE v.status = 'ready'
       GROUP BY v.id
       ORDER BY views DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
