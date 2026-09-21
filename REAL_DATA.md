# UrbanTwin real-data mode

The Zone-Agnostic build now defaults to `URBANTWIN_DATA_MODE=REAL`.

## Live/real sources

- **Roads and building footprints:** OpenStreetMap, retrieved from Overpass for the selected polygon.
- **Terrain/elevation:** Open-Meteo Elevation API, which states that its elevation endpoint is based on Copernicus DEM GLO-90 at 90 m resolution.
- **Historical rainfall:** Open-Meteo Historical Weather API using ERA5-Land reanalysis, with the highest daily precipitation events from 2015–2024 used as selectable events.
- **Waterways:** OpenStreetMap waterway geometry. These are a hydrology/drainage proxy, not verified municipal storm-drain capacity.

## Important data-quality distinction

The application deliberately labels **real geometry** separately from **estimated engineering parameters**. OSM road geometry is real mapped data, but the traffic volume is a highway-class proxy when no observed traffic count is available. OSM waterway geometry is real mapped data, but hydraulic capacity is estimated until an authoritative storm-drain dataset is supplied.

For a municipal/engineering submission, add authoritative drainage capacity and station rainfall observations when licensing/access permits. KSNDMC is the preferred official Karnataka rainfall source for station-based observations; this build does not pretend that Open-Meteo reanalysis is a KSNDMC observation.

## Custom area

Draw any polygon in the React map. Flask sends that polygon to the real-data adapter. Roads, buildings, waterways, elevation cells and the rainfall location are then scoped to the selected area.

## Offline/demo fallback

If internet access or an external service is unavailable, explicitly opt into the old synthetic fallback:

```powershell
$env:URBANTWIN_DATA_MODE="DEMO"
python app.py
```

Do not describe DEMO mode as real data.

## Cache

Fetched datasets are cached under `simulation-service/data/real_cache/` so repeated simulations of the same polygon do not repeatedly download the same data.
