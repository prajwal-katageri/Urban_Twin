# UrbanTwin Data Sources

| Layer | Current real source | Status | Notes |
|---|---|---|---|
| Roads | OpenStreetMap via Overpass | REAL | Geometry and road classes are fetched inside the selected polygon. |
| Buildings | OpenStreetMap via Overpass | REAL | Mapped building footprints; attributes vary by area. |
| Elevation | Copernicus DEM GLO-90 through Open-Meteo Elevation API | REAL | 90 m terrain source; sampled to the simulation grid. |
| Rainfall | Open-Meteo Historical Weather API / ERA5-Land | REAL REANALYSIS | Historical precipitation; not a KSNDMC station observation. |
| Waterways | OpenStreetMap | REAL GEOMETRY | Used as a drainage/hydrology proxy. Hydraulic capacity is estimated until authoritative storm-drain data are supplied. |
| Traffic | OSM highway-class proxy | ESTIMATED | Not a live traffic feed or observed traffic count. |
| Administrative boundaries | User-drawn polygon / existing pilot AOI | USER AOI | Any polygon can be simulated. |

The GBA GIS viewer and current corporation/ward map resources are documented separately as potential authoritative boundary sources. See the project links in the main documentation.
