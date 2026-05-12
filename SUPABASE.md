# Supabase setup

This app can run with local file storage on your laptop, or permanent Supabase storage in production.

## 1. Create the table

In Supabase, open SQL Editor and run `supabase-setup.sql`.

The backend stores the full app state in:

```text
public.study_states
```

## 2. Create the storage bucket

In Supabase Storage, create a private bucket named:

```text
study-files
```

Do not make it public. The Node backend downloads files with the service role key and streams them to the browser.

## 3. Add Render environment variables

In Render, open the web service, then add these under Environment:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_BUCKET=study-files
SUPABASE_STATE_ID=default
APP_SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
```

Keep `SUPABASE_SERVICE_ROLE_KEY` and `APP_SESSION_SECRET` private. They must only live in Render environment variables, never in frontend code.

You can generate a session secret locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Redeploy

After adding variables, click Manual Deploy in Render.

The app will keep using local `data/db.json` when these variables are missing, so local development still works without Supabase.
