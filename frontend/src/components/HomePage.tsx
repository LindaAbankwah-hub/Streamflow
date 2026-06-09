import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface VideoCard {
  id:            string;
  title:         string;
  description:   string;
  thumbnail_url: string;
  duration_secs: number;
  views:         string;
  author:        string;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function formatViews(n: string): string {
  const num = parseInt(n ?? "0");
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k views`;
  return `${num} views`;
}

export function HomePage() {
  const [videos, setVideos]   = useState<VideoCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data) => { setVideos(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: "#fff" }}>
        All Videos
      </h1>

      {loading && (
        <p style={{ color: "#666" }}>Loading videos…</p>
      )}

      {!loading && videos.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎬</div>
          <p style={{ color: "#666", fontSize: 18, marginBottom: 20 }}>
            No videos yet
          </p>
          <Link to="/upload" style={{
            padding: "12px 28px", background: "#e50914", color: "#fff",
            borderRadius: 6, textDecoration: "none", fontWeight: 600,
          }}>
            Upload the first video
          </Link>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 24,
      }}>
        {videos.map((v) => (
          <Link
            key={v.id}
            to={`/watch/${v.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{
              background: "#1a1a1a",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid #2a2a2a",
              transition: "transform 0.15s, border-color 0.15s",
              cursor: "pointer",
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLDivElement).style.borderColor = "#444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "";
                (e.currentTarget as HTMLDivElement).style.borderColor = "#2a2a2a";
              }}
            >
              {/* Thumbnail */}
              <div style={{ position: "relative", paddingTop: "56.25%", background: "#111" }}>
                {v.thumbnail_url ? (
                  <img
                    src={v.thumbnail_url}
                    alt={v.title}
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%", objectFit: "cover",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 48,
                  }}>
                    🎬
                  </div>
                )}
                {v.duration_secs > 0 && (
                  <span style={{
                    position: "absolute", bottom: 8, right: 8,
                    background: "rgba(0,0,0,0.85)", color: "#fff",
                    fontSize: 12, padding: "2px 6px", borderRadius: 4,
                    fontWeight: 600,
                  }}>
                    {formatDuration(v.duration_secs)}
                  </span>
                )}
                <span style={{
                  position: "absolute", top: 8, left: 8,
                  background: "#e50914", color: "#fff",
                  fontSize: 10, padding: "2px 6px", borderRadius: 3,
                  fontWeight: 700, letterSpacing: 0.5,
                }}>
                  HLS
                </span>
              </div>

              {/* Info */}
              <div style={{ padding: "12px 14px 14px" }}>
                <p style={{
                  fontWeight: 600, fontSize: 15, lineHeight: 1.3,
                  marginBottom: 6, color: "#fff",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {v.title}
                </p>
                <p style={{ fontSize: 13, color: "#888" }}>
                  {v.author && <span>{v.author} · </span>}
                  {formatViews(v.views)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
