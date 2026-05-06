# How To Change Service Hours

## Purpose

Update the service-hours text shown in the dashboard footer (**Hours** panel).

## Where hours come from

- Source file: [`public/service-hours.json`](../../public/service-hours.json)
- Loaded by frontend code in [`public/ui.js`](../../public/ui.js)
- Rendered in the footer area defined in [`public/index.html`](../../public/index.html)

## Prerequisites

- You have the official, approved schedule wording from City operations.
- You can edit files in this repository and deploy/restart the app.

## File format

`service-hours.json` must be a JSON object with a top-level `zones` array.

Each zone supports:

- `name` (string): zone title shown in the footer.
- `subtitle` (string, optional): defaults to `Service hours` if omitted.
- `rows` (array): each row is one line of hours.

Each row supports:

- `days` (string): label such as `Monday-Friday`.
- `hours` (string): time range or closed text.
- `closed` (boolean, optional): set `true` to show muted closed styling.

## Steps

1. Open [`public/service-hours.json`](../../public/service-hours.json).
2. Update zone names, day ranges, and hours text as needed.
3. If a row is closed, set `"closed": true` on that row.
4. Save the file.
5. Commit and deploy.
6. Open the dashboard and verify the **Hours** panel matches the approved schedule.

## Example

```json
{
  "zones": [
    {
      "name": "Hollywood West",
      "subtitle": "Service hours",
      "rows": [
        { "days": "Monday-Friday", "hours": "6:00 a.m.-7:00 p.m." },
        { "days": "Saturday", "hours": "9:00 a.m.-5:00 p.m." },
        { "days": "Sunday", "hours": "Closed", "closed": true }
      ]
    }
  ]
}
```

## Verify

- The footer **Hours** panel opens and shows updated text.
- No JavaScript errors appear in the browser console.
- Spelling/capitalization matches the official published schedule.

## Troubleshooting

- **Hours panel is blank:** validate JSON syntax (missing comma/bracket is the most common cause).
- **Only some rows render:** check that each row has both `days` and `hours`.
- **Closed style not applied:** ensure `closed` is a boolean (`true`), not a string (`"true"`).

## Rollback

1. Restore the previous known-good version of [`public/service-hours.json`](../../public/service-hours.json).
2. Redeploy/restart.
3. Recheck the footer panel.
