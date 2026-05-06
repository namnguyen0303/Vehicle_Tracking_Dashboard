# pgAdmin + PostgreSQL Setup for Hollywood App

## Purpose

Set up PostgreSQL + PostGIS using pgAdmin and connect the app database.

## Prerequisites

- PostgreSQL installed
- PostGIS available through Stack Builder
- pgAdmin 4 installed
- `postgres` password available

---

## Steps

### Step 1: Open pgAdmin and Connect

1. Open **pgAdmin 4** from the Start menu (under PostgreSQL).
2. pgAdmin opens in your browser.
3. In the **left sidebar** (Browser), expand **Servers**.
4. Click **PostgreSQL**.
5. When prompted, enter your **postgres password** -> **OK**.
6. You should see **Databases** expand underneath.

---

### Step 2: Create the Database

1. **Right-click** on **Databases** in the left sidebar.
2. Click **Create** -> **Database...**
3. In the **General** tab:
   - **Database:** `hollywood_microtransit`
   - **Owner:** leave as `postgres`
4. Click **Save**.

You should now see `hollywood_microtransit` in the Databases list.

---

### Step 3: Enable PostGIS and Create the App User

1. In the left sidebar, expand **Databases**.
2. **Right-click** on **hollywood_microtransit**.
3. Click **Query Tool**.
4. A new query window opens. Paste this (change the password to something secure):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE USER hollywood_user WITH PASSWORD 'YourSecurePassword123';
GRANT ALL PRIVILEGES ON DATABASE hollywood_microtransit TO hollywood_user;
GRANT ALL ON SCHEMA public TO hollywood_user;
```

5. Click the **Execute** button (▶) or press **F5**.
6. In the bottom **Messages** panel you should see "Query returned successfully".

**Write down the password you used** - you'll need it in Step 5.

---

### Step 4: Create the Tables (Run the Schema)

### Part A: Run the schema

**Option 1 - Open the schema file:**

1. Make sure you're connected to **hollywood_microtransit**. In the left sidebar, expand: **Servers** -> **PostgreSQL** -> **Databases** -> **hollywood_microtransit**.
2. **Right-click** on **hollywood_microtransit**.
3. Click **Query Tool**. A new tab opens with a blank query editor.
4. In the **toolbar** at the top of the query editor, find the **Open File** button - it looks like a folder with an arrow. (If you hover, it may say "Open file").
5. Click it. A file picker opens.
6. Go to: `C:\Users\cudux\Desktop\Documents\Hollywood-app\sql`
7. Select **schema.sql**.
8. Click **Select** or **Open**. The SQL from the file appears in the editor.
9. Click the **Execute** button (▶ play icon) in the toolbar, or press **F5**.
10. Look at the **Messages** tab at the bottom. It should say something like "Query returned successfully" or show the number of commands executed.

**Option 2 - If Open File doesn't work, copy-paste the schema:**

1. Open `C:\Users\cudux\Desktop\Documents\Hollywood-app\sql\schema.sql` in Notepad or VS Code.
2. Select all the content (Ctrl+A) and copy (Ctrl+C).
3. In pgAdmin Query Tool, paste (Ctrl+V) into the empty editor.
4. Click **Execute** (▶) or press **F5**.

---

### Part B: Grant access to hollywood_user

1. In the **same** Query Tool tab, select all the text (Ctrl+A) and delete it, so the editor is empty.
2. Paste this:

```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO hollywood_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hollywood_user;
```

3. Click **Execute** (▶) or press **F5**.
4. The Messages panel should show "Query returned successfully".

---

### If you get an error

| Error                              | What to do                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| "extension postgis does not exist" | PostGIS is not installed. Use Stack Builder to install PostGIS, then run Step 3 again.                                                    |
| "permission denied"                | Make sure you're connected as **postgres** (the default). Right-click the database and choose Query Tool; it uses your server connection. |
| "relation already exists"          | The tables were created earlier. You can skip Part A and only run Part B (the GRANT commands).                                            |

---

### Step 5: Verify the Tables

1. In the left sidebar, expand **hollywood_microtransit** -> **Schemas** -> **public** -> **Tables**.
2. You should see: **alerts**, **vehicles**, **zones**.

If you see them, the database is ready.

---

### Step 6: Link the Project to the Database (.env)

1. Open your project folder in a text editor or VS Code.
2. Open the **`.env`** file (in the project root).
3. Make these changes:

```
DISABLE_DB=false

PGHOST=localhost
PGPORT=5432
PGDATABASE=hollywood_microtransit
PGUSER=hollywood_user
PGPASSWORD=YourSecurePassword123
```

Replace `YourSecurePassword123` with the password you used in Step 3.

4. **Save** the file.

---

### Step 7: Test the Connection

1. Open **Command Prompt** or PowerShell.
2. Go to your project folder:

```cmd
cd C:\Users\cudux\Desktop\Documents\Hollywood-app
```

3. Start the app:

```cmd
npm run dev
```

4. Open http://localhost:3001 in your browser.
5. Log in (e.g. `staff` / `password`).
6. Vehicles from Samsara should appear and be **stored in PostgreSQL**.

---

### Step 8: Check Data in pgAdmin

To see the vehicles in the database:

1. In pgAdmin, right-click **vehicles** table -> **View/Edit Data** -> **All Rows**.
2. After the app runs for a bit, you should see rows with vehicle positions.

---

### Step 9: Import Zones from GeoJSON

Once you have a GeoJSON file from the city:

1. Put the file in your project (e.g. `data/hollywood-service-area.geojson`).
2. From the project folder, run:

```cmd
node scripts/import-zones.js data/hollywood-service-area.geojson
```

Or with npm:

```cmd
npm run import-zones data/hollywood-service-area.geojson
```

3. The script updates the schema if needed (for MultiPolygon support) and inserts zones.
4. Restart the app. Zone compliance checks will now run, and you'll get alerts when vehicles leave the authorized area.

**GeoJSON format:** FeatureCollection with features that have `geometry` (Polygon or MultiPolygon) and `properties` with `name` and optionally `id` or `zone_id`.

---

## Verify

- You can see `alerts`, `vehicles`, and `zones` under `public` schema.
- App starts and login works.
- New vehicle rows appear in pgAdmin after app runs.

## Troubleshooting

| Problem                                 | Fix                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Can't connect to PostgreSQL in pgAdmin  | Check **Services**: `postgresql-x64-16` (or your version) is **Running**     |
| "password authentication failed" in app | Check `.env` - `PGPASSWORD` must match the `hollywood_user` password exactly |
| "relation vehicles does not exist"      | Re-run Step 4 (schema.sql and the GRANT commands)                            |
| "extension postgis does not exist"      | Install PostGIS: Start menu -> PostgreSQL -> Stack Builder -> PostGIS        |

## Rollback

1. Set `DISABLE_DB=true` in `.env` to run without database mode.
2. Restart the app.
3. If needed, recreate the DB and rerun this guide from Step 2.
