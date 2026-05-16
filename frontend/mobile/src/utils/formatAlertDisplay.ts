import { pkMockCategoryFromSignal } from "../api/pkMockFeed";
import type { SignalApi } from "../api/types";

import { PAKISTAN_TIMEZONE } from "../config/pakistan";

export type AlertLocationParts = {
  city: string;
  area: string;
};

/** Split `region` into city + area (province, corridor, or hint from alert text). */
export function parseAlertLocation(signal: SignalApi): AlertLocationParts {
  const region = signal.region?.trim() ?? "";
  const areaHint = extractAreaHintFromText(signal.text);

  if (!region) {
    return { city: "Pakistan", area: areaHint ?? "AOI" };
  }

  if (/[–—]/.test(region)) {
    const parts = region.split(/[–—]/).map((p) => p.trim()).filter(Boolean);
    const city = parts[0] ?? region;
    const area = areaHint ?? parts.slice(1).join(" – ") ?? "—";
    return { city, area };
  }

  const comma = region.split(",").map((p) => p.trim()).filter(Boolean);
  if (comma.length >= 2) {
    const cityPart = comma[0];
    const province = comma[comma.length - 1];
    const cityWords = cityPart.split(/\s+/);
    if (cityWords.length > 1) {
      return {
        city: cityWords[0],
        area: areaHint ?? `${cityWords.slice(1).join(" ")} · ${province}`,
      };
    }
    return { city: cityPart, area: areaHint ?? province };
  }

  if (region.includes("(")) {
    const base = region.replace(/\s*\([^)]*\)\s*/, "").trim();
    const paren = region.match(/\(([^)]+)\)/)?.[1]?.trim();
    return { city: base || region, area: areaHint ?? paren ?? "—" };
  }

  return { city: region, area: areaHint ?? "—" };
}

function extractAreaHintFromText(text: string): string | null {
  const blob = text.trim();
  if (!blob) return null;
  const patterns = [
    /\bnear\s+([^,;.]+)/i,
    /\bat\s+([^,;.]+(?:junction|interchange|corridor|gauge|belt|spur))/i,
    /\bover\s+([^,;.]+)/i,
    /\bin\s+([^,;.]+(?:corridor|wards?|hotspots?))/i,
  ];
  for (const re of patterns) {
    const m = blob.match(re);
    if (m?.[1]) {
      let hint = m[1].trim();
      if (hint.length > 40) hint = `${hint.slice(0, 38)}…`;
      return hint;
    }
  }
  return null;
}

/** Short crisis line from long feed text (first clause / sentence). */
export function extractCrisisHeadline(text: string, maxLen = 80): string {
  let t = text.trim();
  if (!t) return "Alert";

  const clause = t.split(/\s[—–;]\s/)[0]?.trim();
  if (clause && clause.length >= 10) t = clause;

  const sentence = t.match(/^[^.!?]+[.!?]?/)?.[0]?.trim();
  if (sentence && sentence.length >= 10) t = sentence;

  t = t.replace(/\s+/g, " ");
  if (t.length > maxLen) return `${t.slice(0, maxLen - 1)}…`;
  return t;
}

export function formatPktTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const date = d.toLocaleString("en-GB", {
    timeZone: PAKISTAN_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} PKT`;
}

function formatCategoryLabel(signal: SignalApi): string {
  const cat = pkMockCategoryFromSignal(signal);
  if (cat !== "other") return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return signal.kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type FormattedAlertDisplay = {
  /** City · Area · Crisis headline */
  title: string;
  /** Absolute PKT timestamp (+ category) */
  timeLabel: string;
  city: string;
  area: string;
  headline: string;
};

const SEP = " · ";

/**
 * Readable alert layout: city · area · crisis on the title line; PKT timestamp below.
 */
export function formatAlertDisplay(signal: SignalApi): FormattedAlertDisplay {
  const { city, area } = parseAlertLocation(signal);
  const headline = extractCrisisHeadline(signal.text);
  const title = [city, area, headline].filter(Boolean).join(SEP);
  const ts = formatPktTimestamp(signal.recorded_at);
  const category = formatCategoryLabel(signal);
  return {
    title,
    timeLabel: `${ts}${SEP}${category}`,
    city,
    area,
    headline,
  };
}
