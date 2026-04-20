# PostgreSQL + PostGIS Setup Guide

## Purpose

Set up PostgreSQL + PostGIS for the Hollywood Microtransit app.

## Prerequisites

- Windows machine with admin rights
- PostgreSQL installer access
- City/project credentials needed for `.env`

> **Prefer a GUI?** See **[setup-pgadmin.md](setup-pgadmin.md)** for a pgAdmin-only walkthrough.

---

## Using pgAdmin (GUI) Instead of Command Prompt

**pgAdmin** is a graphical dashboard for PostgreSQL. It often installs with PostgreSQL.

- **Find it:** Start menu -> **PostgreSQL** -> **pgAdmin 4**
- **If missing:** The PostgreSQL installer may have skipped it. Re-run the installer and select **pgAdmin** as a component, or download from https://www.pgadmin.org/download/

In pgAdmin you can:
- Browse databases, tables, and data
- Run SQL in a Query Tool (instead of `psql`)
- Create databases and users via right-click menus

The steps below work with **either** Command Prompt (`psql`) **or** pgAdmin. For pgAdmin, use **Tools -> Query Tool** to run the SQL commands.

---

## Steps

### Step 1: Install PostgreSQL

1. Download PostgreSQL for Windows: https://www.postgresql.org/download/windows/
2. Run the installer (PostgreSQL 16 or 17 recommended).
3. During setup:
   - **Set a password for the `postgres` user** - remember this, you'll need it.
   - Keep default port **5432**.
   - When prompted, choose to run **Stack Builder** after install (needed for PostGIS).

---

### Step 2: Install PostGIS

1. After PostgreSQL installs, **Stack Builder** may open automatically. If not, find it in the Start menu under PostgreSQL.
2. Select your PostgreSQL installation -> **Spatial Extensions** -> **PostGIS**.
3. Install PostGIS (accept defaults).

---

### Step 3: Add PostgreSQL to PATH (optional but helpful)

If `psql` is not recognized in Command Prompt:

1. Press **Win + R**, type `sysdm.cpl`, press Enter.
2. Go to **Advanced** tab -> **Environment Variables**.
3. Under **System variables**, select **Path** -> **Edit** -> **New**.
4. Add: `C:\Program Files\PostgreSQL\16\bin` (change `16` if you have a different version).
5. Click OK on all dialogs.
6. Close and reopen Command Prompt.

---

### Step 4: Create Database and User

### Option A: Using pgAdmin (GUI)

1. Open **pgAdmin 4** from the Start menu.
2. In the left sidebar, expand **Servers** -> **PostgreSQL** (enter your `postgres` password if prompted).
3. Right-click **Databases** -> **Create** -> **Database**.
4. Name: `hollywood_microtransit` -> **Save**.
5. Right-click the new database -> **Query Tool**.
6. Paste and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE USER hollywood_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE hollywood_microtransit TO hollywood_user;
GRANT ALL ON SCHEMA public TO hollywood_user;
```

### Option B: Using Command Prompt

Open **Command Prompt** or **PowerShell** and run:

```cmd
psql -U postgres
```

*(If `psql` isn't found, use the full path: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres`)*

Enter your `postgres` password when prompted. Then run these commands **one at a time**:

```sql
-- Create the database
CREATE DATABASE hollywood_microtransit;

-- Connect to it
\c hollywood_microtransit

-- Enable PostGIS (required for geographic queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create app user (replace 'your-secure-password' with a real password)
CREATE USER hollywood_user WITH PASSWORD 'your-secure-password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE hollywood_microtransit TO hollywood_user;
GRANT ALL ON SCHEMA public TO hollywood_user;

-- Exit psql
\q
```

---

### Step 5: Run the Schema

### Option A: Using pgAdmin (GUI)

1. In pgAdmin, right-click **hollywood_microtransit** -> **Query Tool**.
2. Click **Open File** (folder icon) and select `c:\Users\cudux\Desktop\Documents\Hollywood-app\sql\schema.sql`.
3. Click **Execute** (play button) or press F5.
4. Run the grant command: **Query Tool** -> new query, paste:

```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO hollywood_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hollywood_user;
```

Click **Execute**.

### Option B: Using Command Prompt

From your project folder in Command Prompt:

```cmd
cd c:\Users\cudux\Desktop\Documents\Hollywood-app

-- Run schema as postgres (you'll be prompted for postgres password)
psql -U postgres -d hollywood_microtransit -f sql\schema.sql
```

Then grant the app user access to the new tables:

```cmd
psql -U postgres -d hollywood_microtransit -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO hollywood_user; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hollywood_user;"
```

---

### Step 6: Update .env

Edit `.env` in your project and:

1. Set `DISABLE_DB=false`
2. Set `PGPASSWORD` to the password you chose for `hollywood_user`

```env
DISABLE_DB=false

# PostgreSQL connection
PGHOST=localhost
PGPORT=5432
PGDATABASE=hollywood_microtransit
PGUSER=hollywood_user
PGPASSWORD=your-secure-password
```

---

### Step 7: Test

1. Start the app:

```cmd
npm run dev
```

2. Open http://localhost:3000 and log in.
3. Vehicles from Samsara should appear and be stored in PostgreSQL.
4. Zone compliance alerts will work once you add zones (from your city sponsor).

---

## Verify

- `npm run dev` starts without DB errors.
- Dashboard loads and vehicles appear.
- Data is stored in PostgreSQL tables.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `psql` not found | Add PostgreSQL `bin` to PATH (Step 3) or use full path |
| Connection refused | Ensure PostgreSQL service is running: **Services** -> `postgresql-x64-16` -> Start |
| Password authentication failed | Check `PGPASSWORD` in `.env` matches `hollywood_user` password |
| `relation "vehicles" does not exist` | Re-run Step 5: `psql -U postgres -d hollywood_microtransit -f sql\schema.sql` |
| `extension "postgis" does not exist` | Install PostGIS via Stack Builder (Step 2) |

## Rollback

1. Set `DISABLE_DB=true` in `.env` to return to no-DB mode.
2. Restart the app.
3. If needed, remove/recreate DB objects and rerun setup from Step 4.
