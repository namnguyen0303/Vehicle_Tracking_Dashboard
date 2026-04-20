# How To Change Service Zones

## Purpose

Update authorized service zones using a City GIS GeoJSON file.

## Prerequisites

- Zones are stored in PostgreSQL table `zones`.
- The map loads zones from `GET /api/zones`.
- Zone import/update is done through [`scripts/import-zones.js`](../../scripts/import-zones.js).

Provide a GeoJSON file that is one of:
- `FeatureCollection` (recommended)
- `Feature`
- `Polygon` or `MultiPolygon`

Each feature should include:
- `geometry`: `Polygon` or `MultiPolygon`
- `properties.name`: zone display name (required for best results)
- Optional id fields used as `zone_id`: `id`, `zone_id`, `zone`, or `ZONE_ID`

## Steps

1. Save the new GeoJSON in the project (example: `data/hollywood-service-area.geojson`).
2. Open a terminal in the project root.
3. Run import:

```cmd
node scripts/import-zones.js data/hollywood-service-area.geojson
```

Or:

```cmd
npm run import-zones data/hollywood-service-area.geojson
```

4. Restart the app.
5. Confirm zones appear on the map and in/out-of-zone behavior is correct.

## Verify

- Open dashboard and confirm zone polygons render clearly.
- Confirm `GET /api/zones` returns updated zone objects.
- Confirm vehicles inside zones show in-zone status.
- Confirm out-of-zone transitions still create alerts.

## Troubleshooting

- **No zones visible:** check DB mode (`DISABLE_DB=false`) and restart the app.
- **Geometry type error:** ensure all features are `Polygon` or `MultiPolygon`.
- **Unexpected zone IDs:** include stable `properties.zone_id` (or `id`) in the source GeoJSON.

## Rollback

1. Keep a copy of the previous GeoJSON before each import.
2. Re-run import with the previous known-good GeoJSON.
3. Restart the app and re-check `GET /api/zones`.

## Notes

- The import script inserts new zones and updates existing zones by `zone_id`.
- Import uses PostGIS geometry (`ST_GeomFromGeoJSON`) for spatial checks.
