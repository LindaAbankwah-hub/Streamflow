import { useEffect, useState } from "react";

interface DropOffPoint    { bucket: number; pct_retained: number }
interface QualityPoint    { quality: string; count: string }
interface BandwidthPoint  { bucket_30s: number; avg_bandwidth: number }

interface Analytics {
  totalViews:       number;
  avgPositionSecs:  number;
  durationSecs:     number;
  dropOffCurve:     DropOffPoint[];
  qualityDist:      QualityPoint[];
  bandwidthOverTime: BandwidthPoint[];
}

export function AnalyticsDash({ videoId }: { videoId: string }) {
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/${videoId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoad(false); })
      .catch(() => setLoad(false));
  }, [videoId]);

  if (loading) return <p style={{ color: "#666", padding: 16 }}>Loading analytics…</p>;
  if (!data)   return <p style={{ color: "#666", padding: 16 }}>No analytics yet</p>;

  const completion = data.durationSecs
    ? Math.round((data.avgPositionSecs / data.durationSecs) * 100)
    : 0;

  const totalQuality = data.qualityDist.reduce((a, b) => a + parseInt(b.count), 0);

  return (
    <div style={{ padding: "24px 0", borderTop: "1px solid #222", marginTop: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: "#fff" }}>
        Video Analytics
      </h3>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Total views",     value: data.totalViews.toString() },
          { label: "Avg completion",  value: `${completion}%` },
          { label: "Avg watch time",  value: `${Math.round(data.avgPositionSecs)}s` },
        ].map((card) => (
          <div key={card.label} style={{
            flex: "1 1 100px", padding: "14px 16px",
            background: "#1a1a1a", borderRadius: 8,
            border: "1px solid #2a2a2a", textAlign: "center",
          }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{card.value}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Drop-off curve */}
      <h4 style={{ fontSize: 14, color: "#aaa", marginBottom: 12, fontWeight: 500 }}>
        Viewer drop-off curve
      </h4>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, marginBottom: 6 }}>
        {data.dropOffCurve.map((pt) => {
          const pct = Number(pt.pct_retained) || 0;
          const hue = Math.round(pct * 1.2);
          return (
            <div
              key={pt.bucket}
              title={`${pt.bucket * 10}% through video: ${pct}% still watching`}
              style={{
                flex: 1,
                height: `${pct}%`,
                background: `hsl(${hue}, 70%, 45%)`,
                borderRadius: "2px 2px 0 0",
                transition: "height 0.4s",
                minHeight: 2,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 24 }}>
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>
        Green = high retention · Red = viewers dropped off · Hover a bar to see exact numbers
      </p>

      {/* Quality distribution */}
      {data.qualityDist.length > 0 && (
        <>
          <h4 style={{ fontSize: 14, color: "#aaa", marginBottom: 12, fontWeight: 500 }}>
            Quality distribution
          </h4>
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {data.qualityDist.map((q) => {
              const pct = totalQuality > 0
                ? Math.round((parseInt(q.count) / totalQuality) * 100)
                : 0;
              return (
                <div key={q.quality} style={{
                  flex: "1 1 80px",
                  padding: "12px 10px",
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8, textAlign: "center",
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#e50914" }}>{pct}%</div>
                  <div style={{ fontSize: 13, color: "#fff", marginTop: 2 }}>{q.quality}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bandwidth over time */}
      {data.bandwidthOverTime.length > 0 && (
        <>
          <h4 style={{ fontSize: 14, color: "#aaa", marginBottom: 12, fontWeight: 500 }}>
            Average viewer bandwidth (kbps)
          </h4>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
            {data.bandwidthOverTime.map((pt) => {
              const max = Math.max(...data.bandwidthOverTime.map((p) => p.avg_bandwidth));
              const h   = max > 0 ? (pt.avg_bandwidth / max) * 100 : 0;
              return (
                <div
                  key={pt.bucket_30s}
                  title={`${pt.bucket_30s * 30}s: ${pt.avg_bandwidth} kbps`}
                  style={{
                    flex: 1, height: `${h}%`,
                    background: "#378ADD",
                    borderRadius: "2px 2px 0 0",
                    minHeight: 2,
                  }}
                />
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "#555", marginTop: 6 }}>Each bar = 30-second window</p>
        </>
      )}
    </div>
  );
}
