import "../firebase-admin";

import { mergeApiHealthDoc, mergeSignalDoc, fetchWithTimeout } from "./persist";

const SIGNAL_DOC_ID = "weather-islamabad";
const API_HEALTH_ID = "open-meteo";

export type WeatherBundle = {
  forecast: Record<string, unknown> | null;
  airQualityDust: Record<string, unknown> | null;
  mergedHourlyDust?: Record<string, unknown> | null;
};

function mergeWeatherResponses(
  forecast: Record<string, unknown>,
  airQuality: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!airQuality?.hourly || !forecast.hourly) return forecast;
  const fHourly = forecast.hourly as Record<string, unknown>;
  const aqHourly = airQuality.hourly as Record<string, unknown>;
  const dust = aqHourly.dust;
  if (dust != null) {
    return {
      ...forecast,
      hourly: { ...fHourly, dust },
      current: {
        ...(forecast.current as Record<string, unknown>),
        ...(airQuality.current && typeof airQuality.current === "object"
          ? Object.fromEntries(
              Object.entries(airQuality.current as Record<string, unknown>).filter(
                ([k]) => k === "dust" || k === "visibility",
              ),
            )
          : {}),
      },
    };
  }
  return forecast;
}

export async function getWeatherData(lat: number, lng: number): Promise<WeatherBundle> {
  const empty: WeatherBundle = { forecast: null, airQualityDust: null, mergedHourlyDust: null };
  const latClamped = Number.isFinite(lat) ? lat : 33.6844;
  const lngClamped = Number.isFinite(lng) ? lng : 73.0479;
  const t0 = Date.now();

  let forecastJson: Record<string, unknown> | null = null;
  let airJson: Record<string, unknown> | null = null;

  try {
    const base = "https://api.open-meteo.com/v1/forecast";
    const params = new URLSearchParams({
      latitude: String(latClamped),
      longitude: String(lngClamped),
      timezone: "Asia/Karachi",
      forecast_days: "2",
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "wind_speed_10m",
        "wind_direction_10m",
        "dust",
        "visibility",
      ].join(","),
      hourly: [
        "precipitation",
        "temperature_2m",
        "dust",
        "visibility",
        "wind_speed_10m",
        "wind_direction_10m",
      ].join(","),
    });
    const forecastUrl = `${base}?${params.toString()}`;

    try {
      const res = await fetchWithTimeout(forecastUrl);
      if (!res.ok) {
        throw new Error(`forecast ${res.status}`);
      }
      forecastJson = (await res.json()) as Record<string, unknown>;
    } catch {
      const paramsMin = new URLSearchParams({
        latitude: String(latClamped),
        longitude: String(lngClamped),
        timezone: "Asia/Karachi",
        forecast_days: "2",
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "precipitation",
          "wind_speed_10m",
          "wind_direction_10m",
        ].join(","),
        hourly: ["precipitation", "temperature_2m", "wind_speed_10m", "wind_direction_10m"].join(","),
      });
      const res2 = await fetchWithTimeout(`${base}?${paramsMin.toString()}`);
      if (!res2.ok) throw new Error(`forecast_retry ${res2.status}`);
      forecastJson = (await res2.json()) as Record<string, unknown>;
    }

    try {
      const aqBase = "https://air-quality-api.open-meteo.com/v1/air-quality";
      const aqParams = new URLSearchParams({
        latitude: String(latClamped),
        longitude: String(lngClamped),
        timezone: "Asia/Karachi",
        forecast_days: "2",
        hourly: "dust",
        current: "dust",
      });
      const aqRes = await fetchWithTimeout(`${aqBase}?${aqParams.toString()}`);
      if (aqRes.ok) {
        airJson = (await aqRes.json()) as Record<string, unknown>;
      }
    } catch {
      airJson = null;
    }

    const merged = airJson ? mergeWeatherResponses(forecastJson, airJson) : forecastJson;

    await mergeSignalDoc(SIGNAL_DOC_ID, {
      kind: "weather_forecast",
      source: "open-meteo",
      sourceId: API_HEALTH_ID,
      lat: latClamped,
      lng: lngClamped,
      credibility: 94,
      payload: merged,
    });
    await mergeApiHealthDoc(API_HEALTH_ID, {
      id: API_HEALTH_ID,
      label: "Open-Meteo",
      status: "live",
      latencyMs: Date.now() - t0,
      lastSuccess: true,
      error: null,
    });

    return {
      forecast: merged,
      airQualityDust: airJson,
      mergedHourlyDust: (merged?.hourly as Record<string, unknown>) ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await mergeApiHealthDoc(API_HEALTH_ID, {
      id: API_HEALTH_ID,
      label: "Open-Meteo",
      status: "degraded",
      latencyMs: Date.now() - t0,
      lastSuccess: false,
      error: msg,
    });
    return empty;
  }
}
