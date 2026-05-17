import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();

const APK_FILENAME = "aegis-mobile.apk";

function apkCandidatePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "releases", APK_FILENAME),
    path.join(cwd, "..", "frontend", "mobile", "releases", APK_FILENAME),
  ];
}

function resolveLocalApk(): { filePath: string; sizeBytes: number } | null {
  for (const filePath of apkCandidatePaths()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size < 1_000_000) continue;
      return { filePath, sizeBytes: stat.size };
    } catch {
      /* try next */
    }
  }
  return null;
}

function externalApkUrl(): string | null {
  const url =
    process.env.MOBILE_APK_DOWNLOAD_URL?.trim() ||
    process.env.EXPO_PUBLIC_MOBILE_APK_URL?.trim() ||
    "";
  return url.startsWith("http") ? url : null;
}

router.get("/apk/info", (_req, res) => {
  const local = resolveLocalApk();
  const external = externalApkUrl();
  res.json({
    success: true,
    data: {
      available: Boolean(local || external),
      filename: APK_FILENAME,
      local: local
        ? { sizeBytes: local.sizeBytes, sizeMb: (local.sizeBytes / (1024 * 1024)).toFixed(1) }
        : null,
      downloadPath: "/download/apk",
      pagePath: "/download",
      externalUrl: external,
    },
    error: null,
  });
});

router.get("/", (req, res) => {
  const local = resolveLocalApk();
  const external = externalApkUrl();
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:8080";
  const base = `${proto}://${host}`;
  const directUrl = `${base}/download/apk`;
  const sizeMb = local ? (local.sizeBytes / (1024 * 1024)).toFixed(1) : null;
  const canDownload = Boolean(local || external);
  const primary = local ? directUrl : external ?? directUrl;
  const note = local
    ? `Ready (${sizeMb} MB) — tap to download and install on Android.`
    : external
      ? "Hosted build — tap to download. Allow installs from unknown sources if prompted."
      : "APK not on this server yet. Run npm run build:apk in frontend/mobile, then copy to cloud-run/releases/aegis-mobile.apk.";

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aegis — Android APK</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(160deg, #0f172a, #134e4a); color: #f8fafc; padding: 24px; }
    .card { max-width: 420px; width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; font-weight: 800; }
    p { margin: 0 0 20px; line-height: 1.5; color: #cbd5e1; }
    a.btn { display: block; text-align: center; padding: 14px; border-radius: 14px; font-weight: 800;
      text-decoration: none; background: #14b8a6; color: #042f2e; }
    a.btn.off { pointer-events: none; opacity: 0.45; background: #64748b; color: #e2e8f0; }
    .sub { margin-top: 16px; font-size: 0.8rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Aegis Mobile</h1>
    <p>${note}</p>
    <a class="btn${canDownload ? "" : " off"}" href="${canDownload ? primary : "#"}">Download APK</a>
    <p class="sub">com.aegis.mobile — set API URL in Settings (same Wi‑Fi as cloud-run :8080).</p>
  </div>
</body>
</html>`);
});

router.get("/apk", (req, res) => {
  const external = externalApkUrl();
  const local = resolveLocalApk();
  if (!local && external) {
    res.redirect(302, external);
    return;
  }
  if (!local) {
    res.status(404).json({
      success: false,
      data: null,
      error: "apk_not_found",
      hint: "Run npm run build:apk in frontend/mobile and copy releases/aegis-mobile.apk to cloud-run/releases/",
    });
    return;
  }
  res.download(local.filePath, APK_FILENAME);
});

export default router;
