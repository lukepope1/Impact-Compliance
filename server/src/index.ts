import "dotenv/config";
import cors from "cors";
import express from "express";
import { requireAuth } from "./middleware/auth";
import { dealsRouter } from "./routes/deals";
import { requirementDefinitionsRouter } from "./routes/requirementDefinitions";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/deals", requireAuth, dealsRouter);
app.use("/api/deals/:dealId/requirement-definitions", requireAuth, requirementDefinitionsRouter);

const port = Number(process.env.PORT ?? 4100);
app.listen(port, () => {
  console.log(`NMTC Compliance Platform API listening on :${port}`);
});
