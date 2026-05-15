/**
 * AEGIS Cloud Run — Express entry (stub routes only).
 */
import "./firebase-admin";

import express from "express";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 8080;

function stub() {
  return { success: true, stub: true };
}

app.get("/health", (_req, res) => {
  res.json(stub());
});

app.post("/pipeline/run", (_req, res) => {
  res.json(stub());
});

app.post("/scrape/pmd", (_req, res) => {
  res.json(stub());
});

app.post("/scrape/ndma", (_req, res) => {
  res.json(stub());
});

app.post("/health/check-apis", (_req, res) => {
  res.json(stub());
});

app.get("/api/air-quality", (_req, res) => {
  res.json(stub());
});

app.get("/api/traffic", (_req, res) => {
  res.json(stub());
});

app.post("/api/alerts/send", (_req, res) => {
  res.json(stub());
});

app.listen(PORT, () => {
  console.log(`aegis-cloud-run listening on ${PORT}`);
});
