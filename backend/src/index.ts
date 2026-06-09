import "dotenv/config";
import express from "express";
import cors from "cors";
import { uploadRouter }    from "./routes/upload";
import { videosRouter }    from "./routes/videos";
import { analyticsRouter } from "./routes/analytics";
import { recommendRouter } from "./routes/recommendations";

const app  = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.use("/api/upload",          uploadRouter);
app.use("/api/videos",          videosRouter);
app.use("/api/analytics",       analyticsRouter);
app.use("/api/recommendations", recommendRouter);

app.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date() }));

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
});
