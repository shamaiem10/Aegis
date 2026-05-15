"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeatherData = getWeatherData;
require("../firebase-admin");
const persist_1 = require("./persist");
const SIGNAL_DOC_ID = "weather-islamabad";
const API_HEALTH_ID = "open-meteo";
function mergeWeatherResponses(forecast, airQuality) {
    if (!airQuality?.hourly || !forecast.hourly)
        return forecast;
    const fHourly = forecast.hourly;
    const aqHourly = airQuality.hourly;
    const dust = aqHourly.dust;
    if (dust != null) {
        return {
            ...forecast,
            hourly: { ...fHourly, dust },
            current: {
                ...forecast.current,
                ...(airQuality.current && typeof airQuality.current === "object"
                    ? Object.fromEntries(Object.entries(airQuality.current).filter(([k]) => k === "dust" || k === "visibility"))
                    : {}),
            },
        };
    }
    return forecast;
}
async function getWeatherData(lat, lng) {
    const empty = { forecast: null, airQualityDust: null, mergedHourlyDust: null };
    const latClamped = Number.isFinite(lat) ? lat : 33.6844;
    const lngClamped = Number.isFinite(lng) ? lng : 73.0479;
    const t0 = Date.now();
    let forecastJson = null;
    let airJson = null;
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
            const res = await (0, persist_1.fetchWithTimeout)(forecastUrl);
            if (!res.ok) {
                throw new Error(`forecast ${res.status}`);
            }
            forecastJson = (await res.json());
        }
        catch {
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
            const res2 = await (0, persist_1.fetchWithTimeout)(`${base}?${paramsMin.toString()}`);
            if (!res2.ok)
                throw new Error(`forecast_retry ${res2.status}`);
            forecastJson = (await res2.json());
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
            const aqRes = await (0, persist_1.fetchWithTimeout)(`${aqBase}?${aqParams.toString()}`);
            if (aqRes.ok) {
                airJson = (await aqRes.json());
            }
        }
        catch {
            airJson = null;
        }
        const merged = airJson ? mergeWeatherResponses(forecastJson, airJson) : forecastJson;
        await (0, persist_1.mergeSignalDoc)(SIGNAL_DOC_ID, {
            kind: "weather_forecast",
            source: "open-meteo",
            sourceId: API_HEALTH_ID,
            lat: latClamped,
            lng: lngClamped,
            credibility: 94,
            payload: merged,
        });
        await (0, persist_1.mergeApiHealthDoc)(API_HEALTH_ID, {
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
            mergedHourlyDust: merged?.hourly ?? null,
        };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await (0, persist_1.mergeApiHealthDoc)(API_HEALTH_ID, {
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
