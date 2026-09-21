# Optional authoritative datasets

Place licensed/authorized municipal or agency datasets here when you have them.

## Rainfall CSV

A supported station CSV can use:

```text
date,rainfall_mm,station,latitude,longitude
2024-08-20,120,Station A,12.97,77.59
```

The current default remains Open-Meteo ERA5-Land reanalysis because it is programmatically retrievable for arbitrary user-drawn zones. Do not label reanalysis as KSNDMC observation data.

## Storm drainage GeoJSON

Provide a GeoJSON FeatureCollection of drain lines. Each feature may include:

```json
{
  "capacity": 75,
  "capacityUnit": "m3/s",
  "source": "municipal-authority"
}
```

If municipal capacity is absent, the OSM waterway proxy remains explicitly marked as estimated.
