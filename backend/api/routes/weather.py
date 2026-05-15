from typing import Annotated

from fastapi import APIRouter, Query

from tools.open_meteo import forecast_snapshot, geocode_city

router = APIRouter(tags=["weather"], prefix="/weather")


@router.get("/forecast")
async def forecast(lat: float, lon: float):
    return await forecast_snapshot(lat, lon)


@router.get("/forecast/by-city")
async def forecast_city(
    name: Annotated[str, Query(min_length=2)],
    country: Annotated[str, Query()] = "PK",
):
    coords = await geocode_city(name, country_codes=country.lower())
    if not coords:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="city_not_found")
    lat, lon = coords
    data = await forecast_snapshot(lat, lon)
    return {"lat": lat, "lon": lon, "forecast": data}
