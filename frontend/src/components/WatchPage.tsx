import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { VideoPlayer }   from "./VideoPlayer";
import { AnalyticsDash } from "./AnalyticsDash";

interface Video {
  id:            string;
  title:         string;
  description:   string;
  masterUrl:     string;
  subtitleUrl:   string | null;
  duration_secs: number;
  thumbnail_url: string;
  status:        string;
}

interface RecVideo {
  id:            string;
  title:         string;
  thumbnail_url: string;
  duration_secs: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo]         = useState<Video | null>(null);
  const [recs,  setRecs]          = useState<RecVideo[]>([]);
  const [showAnalytics, setShowA] = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    fetch(`/api/videos/${id}`)
      .then((r) => r.json())
      .then((v) => { setVideo(v); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`/api/recommendations/user-demo`)
      .then((r) => r.json())
      .then((d) => setRecs((d.videos ?? []).slice(0, 8)))
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#666" }}>
        Loading video…
      </div>
    );
  }

  if (!video) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ color: "#666", marginBottom: 16 }}>Video not found</p>
        <Link to="/" style={{ color: "#e50914" }}>← Back to home</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 28px" }}>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <VideoPlayer
            masterUrl={video.masterUrl}
            subtitleUrl={video.subtitleUrl}
            videoId={video.id}
            userId="user-demo"
          />

          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "16px 0 8px", color: "#fff" }}>
            {video.title}
          </h1>

          {video.description && (
            <p style={{ color: "#888", lineHeight: 1.6, fontSize: 14, marginBottom: 16 }}>
              {video.description}
            </p>
          )}

          {/* Info row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: 16, flexWrap: "wrap",
          }}>
            {video.duration_secs > 0 && (
              <span style={{
                background: "#1a1a1a", border: "1px solid #2a2a2a",
                borderRadius: 5, padding: "3px 10px",
                fontSize: 13, color: "#aaa",
              }}>
                {formatDuration(video.duration_secs)}
              </span>
            )}
            {video.subtitleUrl && (
              <span style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 5, padding: "3px 10px",
                fontSize: 13, color: "#34d399",
              }}>
                CC subtitles
              </span>
            )}
            <span style={{
              background: "rgba(229,9,20,0.15)",
              border: "1px solid rgba(229,9,20,0.3)",
              borderRadius: 5, padding: "3px 10px",
              fontSize: 13, color: "#f87171",
            }}>
              HLS Adaptive
            </span>
          </div>

          {/* Analytics toggle */}
          <button
            onClick={() => setShowA((s) => !s)}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid #333",
              borderRadius: 6, color: "#aaa",
              cursor: "pointer", fontSize: 13,
            }}
          >
            {showAnalytics ? "▲ Hide analytics" : "▼ Show analytics"}
          </button>

          {showAnalytics && <AnalyticsDash videoId={video.id} />}
        </div>

        {/* Sidebar: recommendations */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#aaa" }}>
            Up next
          </h3>
          {recs.length === 0 && (
            <p style={{ color: "#555", fontSize: 13 }}>No recommendations yet</p>
          )}
          {recs.map((rec) => (
            <Link
              key={rec.id}
              to={`/watch/${rec.id}`}
              style={{ display: "flex", gap: 10, marginBottom: 14, textDecoration: "none" }}
            >
              <div style={{
                width: 130, height: 74, flexShrink: 0,
                background: "#1a1a1a", borderRadius: 5,
                overflow: "hidden", position: "relative",
              }}>
                {rec.thumbnail_url ? (
                  <img
                    src={rec.thumbnail_url}
                    alt={rec.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "center", height: "100%", fontSize: 24,
                  }}>
                    🎬
                  </div>
                )}
                {rec.duration_secs > 0 && (
                  <span style={{
                    position: "absolute", bottom: 4, right: 4,
                    background: "rgba(0,0,0,0.85)", color: "#fff",
                    fontSize: 11, padding: "1px 5px", borderRadius: 3,
                  }}>
                    {formatDuration(rec.duration_secs)}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14, fontWeight: 500, color: "#fff",
                  lineHeight: 1.3, marginBottom: 4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {rec.title}
                </p>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
