import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
  masterUrl:     string;
  subtitleUrl?:  string | null;
  videoId:       string;
  userId?:       string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

interface PlayerStats {
  levelName:     string;
  bandwidthKbps: number;
  bufferedSecs:  number;
}

export function VideoPlayer({
  masterUrl,
  subtitleUrl,
  videoId,
  userId = "user-demo",
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<Hls | null>(null);
  const sessionId    = useRef(crypto.randomUUID());
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  const [stats, setStats]         = useState<PlayerStats>({ levelName: "auto", bandwidthKbps: 0, bufferedSecs: 0 });
  const [levels, setLevels]       = useState<{ name: string; bitrate: number }[]>([]);
  const [manualLevel, setManual]  = useState(-1);   // -1 = ABR auto
  const [showStats, setShowStats] = useState(false);
  const [qualityOpen, setQOpen]   = useState(false);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const sendEvent = useCallback(
    async (eventType: string, extra: Record<string, unknown> = {}) => {
      const video = videoRef.current;
      if (!video) return;
      try {
        await fetch("/api/analytics/event", {
          method:  "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            videoId,
            userId,
            sessionId:     sessionId.current,
            positionSecs:  Math.round(video.currentTime),
            quality:       stats.levelName,
            bandwidthKbps: stats.bandwidthKbps,
            eventType,
            ...extra,
          }),
        });
      } catch { /* non-blocking */ }
    },
    [videoId, userId, stats]
  );

  // ── HLS setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !masterUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        // ABR tuning — matches YouTube's conservative upgrade policy
        abrEwmaFastLive:    3.0,
        abrEwmaSlowLive:    9.0,
        abrBandWidthFactor:   0.95,   // use 95% of measured bandwidth
        abrBandWidthUpFactor: 0.70,   // conservative on quality upgrades

        // Buffering
        maxBufferLength:    30,
        maxMaxBufferLength: 60,

        // Start at lowest quality for fast first frame
        startLevel: 0,
      });

      hls.loadSource(masterUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels.map((l) => ({ name: `${l.height}p`, bitrate: l.bitrate })));
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const level = hls.levels[data.level];
        setStats((s) => ({ ...s, levelName: `${level.height}p` }));
        sendEvent("quality_change", { newQuality: `${level.height}p` });
      });

      // Measure real bandwidth from each downloaded segment
      hls.on(Hls.Events.FRAG_LOADED, (_e, data) => {
        const { loaded, loading } = data.frag.stats;
        const durationMs = loading.end - loading.start;
        const kbps = durationMs > 0 ? Math.round((loaded * 8) / durationMs) : 0;

        const buffered = video.buffered.length
          ? video.buffered.end(video.buffered.length - 1) - video.currentTime
          : 0;

        setStats((s) => ({
          ...s,
          bandwidthKbps: kbps,
          bufferedSecs:  Math.round(buffered),
        }));
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data);
          hls.recoverMediaError();
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = masterUrl;
    }
  }, [masterUrl]);

  // Apply manual quality level
  useEffect(() => {
    if (hlsRef.current) hlsRef.current.currentLevel = manualLevel;
  }, [manualLevel]);

  // Heartbeat every 10s
  useEffect(() => {
    heartbeatRef.current = setInterval(() => sendEvent("heartbeat"), 10_000);
    return () => clearInterval(heartbeatRef.current);
  }, [sendEvent]);

  return (
    <div style={{ position: "relative", background: "#000", borderRadius: 8, overflow: "hidden" }}>
      <video
        ref={videoRef}
        style={{ width: "100%", display: "block", minHeight: 200 }}
        controls
        crossOrigin="anonymous"
        onPlay={()   => sendEvent("play")}
        onPause={() => sendEvent("pause")}
        onSeeked={() => sendEvent("seek")}
        onEnded={()  => sendEvent("ended")}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) onTimeUpdate?.(v.currentTime, v.duration);
        }}
      >
        {subtitleUrl && (
          <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />
        )}
      </video>

      {/* Stats overlay (toggle with S key) */}
      {showStats && (
        <div style={{
          position: "absolute", top: 10, left: 10,
          background: "rgba(0,0,0,0.75)", color: "#0f0",
          fontFamily: "monospace", fontSize: 12,
          padding: "6px 10px", borderRadius: 5, lineHeight: 1.7,
          pointerEvents: "none",
        }}>
          <div>Quality: {stats.levelName}</div>
          <div>Bandwidth: {stats.bandwidthKbps} kbps</div>
          <div>Buffer: {stats.bufferedSecs}s</div>
        </div>
      )}

      {/* Controls row */}
      <div style={{
        position: "absolute", top: 10, right: 10,
        display: "flex", gap: 8,
      }}>
        {/* Stats toggle */}
        <button
          onClick={() => setShowStats((s) => !s)}
          title="Toggle debug stats"
          style={overlayBtn}
        >
          {showStats ? "Hide stats" : "Stats"}
        </button>

        {/* Quality selector */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setQOpen((o) => !o)} style={overlayBtn}>
            {manualLevel === -1 ? "Auto" : levels[manualLevel]?.name ?? "Auto"} ▾
          </button>
          {qualityOpen && (
            <div style={{
              position: "absolute", top: 32, right: 0,
              background: "rgba(18,18,18,0.97)",
              border: "1px solid #333", borderRadius: 7,
              overflow: "hidden", minWidth: 130,
            }}>
              <QualityOption
                label="Auto (ABR)"
                active={manualLevel === -1}
                onClick={() => { setManual(-1); setQOpen(false); }}
              />
              {levels.map((l, i) => (
                <QualityOption
                  key={l.name}
                  label={`${l.name}  ${Math.round(l.bitrate / 1000)}k`}
                  active={manualLevel === i}
                  onClick={() => { setManual(i); setQOpen(false); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayBtn: React.CSSProperties = {
  background: "rgba(0,0,0,0.65)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.25)",
  padding: "4px 10px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};

function QualityOption({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "9px 16px",
        cursor: "pointer",
        fontSize: 13,
        color:      active ? "#fff" : "#aaa",
        background: active ? "rgba(229,9,20,0.2)" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {label}
    </div>
  );
}
