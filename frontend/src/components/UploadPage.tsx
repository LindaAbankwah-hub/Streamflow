import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";

type Status = "idle" | "uploading" | "processing" | "ready" | "failed";

export function UploadPage() {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [status, setStatus]     = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select a video file"); return; }
    if (!title.trim()) { setError("Please enter a title"); return; }

    setStatus("uploading");
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title.trim());
    formData.append("description", description.trim());

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("x-user-id", "user-demo");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { videoId: string };
        setVideoId(data.videoId);
        setStatus("processing");
        pollStatus(data.videoId);
      } else {
        setStatus("failed");
        setError(`Upload failed: ${xhr.statusText}`);
      }
    };

    xhr.onerror = () => {
      setStatus("failed");
      setError("Network error — is the backend running on port 4000?");
    };

    xhr.send(formData);
  }

  function pollStatus(id: string) {
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/videos/${id}/status`);
        const data = await res.json() as { status: string };
        if (data.status === "ready") {
          setStatus("ready");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setStatus("failed");
          setError("Transcoding failed. Check the worker terminal for errors.");
          clearInterval(interval);
        }
      } catch { /* keep polling */ }
    }, 3000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 7, color: "#fff", fontSize: 15,
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: 6,
    fontSize: 14, color: "#aaa", fontWeight: 500,
  };

  return (
    <main style={{ maxWidth: 600, margin: "48px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Upload a video</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>
        Your video will automatically be transcoded to 360p, 720p and 1080p HLS.
        Subtitles are generated automatically via Whisper AI.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#e50914" : "#333"}`,
          borderRadius: 10, padding: "40px 20px",
          textAlign: "center", cursor: "pointer",
          background: dragOver ? "rgba(229,9,20,0.05)" : "#111",
          marginBottom: 24, transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
        <p style={{ color: "#aaa", marginBottom: 6 }}>
          Drag & drop a video file here, or click to browse
        </p>
        <p style={{ color: "#555", fontSize: 13 }}>MP4, MOV, MKV, AVI — up to 5 GB</p>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
          disabled={status !== "idle"}
        />
      </div>

      {/* Form fields */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your video a title"
          disabled={status !== "idle"}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Optional description"
          disabled={status !== "idle"}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: 12, background: "rgba(229,9,20,0.1)",
          border: "1px solid rgba(229,9,20,0.3)",
          borderRadius: 7, marginBottom: 16, color: "#f87171", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* Upload button */}
      {status === "idle" && (
        <button
          onClick={handleUpload}
          style={{
            width: "100%", padding: "13px 0",
            background: "#e50914", color: "#fff",
            border: "none", borderRadius: 7,
            fontWeight: 700, fontSize: 16, cursor: "pointer",
          }}
        >
          Upload & Transcode
        </button>
      )}

      {/* Upload progress */}
      {status === "uploading" && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            marginBottom: 8, fontSize: 14, color: "#aaa",
          }}>
            <span>Uploading to S3…</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      {/* Processing */}
      {status === "processing" && (
        <div style={{
          padding: 20, background: "#1a1a1a",
          border: "1px solid #2a2a2a", borderRadius: 8,
        }}>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>
            ⚙️ Transcoding in progress…
          </p>
          <ProgressBar value={null} />
          <p style={{ marginTop: 12, color: "#666", fontSize: 13, lineHeight: 1.6 }}>
            FFmpeg is converting your video to 360p / 720p / 1080p HLS segments.
            This takes 1–5 minutes depending on video length.
            Subtitles are being generated in parallel via Whisper AI.
          </p>
        </div>
      )}

      {/* Ready */}
      {status === "ready" && videoId && (
        <div style={{
          padding: 20, background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8,
        }}>
          <p style={{ color: "#34d399", fontWeight: 700, fontSize: 17, marginBottom: 12 }}>
            ✅ Video is live!
          </p>
          <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
            Transcoding complete. All three quality levels are ready.
          </p>
          <Link to={`/watch/${videoId}`} style={{
            display: "inline-block",
            padding: "10px 24px", background: "#e50914",
            color: "#fff", borderRadius: 6, textDecoration: "none",
            fontWeight: 600,
          }}>
            Watch now →
          </Link>
        </div>
      )}
    </main>
  );
}

function ProgressBar({ value }: { value: number | null }) {
  return (
    <div style={{
      height: 6, background: "#2a2a2a",
      borderRadius: 3, overflow: "hidden",
    }}>
      <div style={{
        height: "100%",
        background: "#e50914",
        borderRadius: 3,
        width:      value !== null ? `${value}%` : "40%",
        transition: value !== null ? "width 0.3s" : "none",
        ...(value === null && {
          animation: "slide 1.4s ease-in-out infinite",
        }),
      }} />
      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
