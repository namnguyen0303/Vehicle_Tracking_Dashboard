# City Handover Documentation

This folder is the City operations package for this project. Use it for setup, day-to-day updates, and basic administration.

## Recommended order

1. Read the project overview: [`README.md`](../../README.md)
2. Set up PostgreSQL/PostGIS:
   - CLI + mixed workflow: [`setup.md`](./setup.md)
   - pgAdmin-only workflow: [`setup-pgadmin.md`](./setup-pgadmin.md)
3. Review routine updates:
   - Service hours: [`change-service-hours.md`](./change-service-hours.md)
   - Service zones: [`change-service-zones.md`](./change-service-zones.md)
   - Login credentials: [`change-login-credentials.md`](./change-login-credentials.md)
4. Complete environment handoff:
   - Safe environment template: [`.env.city.template`](./.env.city.template)

## Quick Operations Links

- Service hours file: [`public/service-hours.json`](../../public/service-hours.json)
- Service hours update guide: [`change-service-hours.md`](./change-service-hours.md)
- Zone import script: [`scripts/import-zones.js`](../../scripts/import-zones.js)
- Login route (current auth): [`src/routes/auth.js`](../../src/routes/auth.js)
- Root env example: [`.env.example`](../../.env.example)

## Important notes

- The current login system uses hardcoded users and is intended for demo/internal use.
- For long-term production use, move to secure database-backed authentication.
- For billing/reporting endpoints, see the API section in [`README.md`](../../README.md).
