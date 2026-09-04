# Family Bank

A simple app for tracking kids' allowance: multiple kid accounts, deposits/withdrawals with notes, monthly interest, and a view-only login for kids. Runs on Supabase (free database + login) and Vercel (free hosting).

**How the kid view works:** each kid gets a short access code (shown on their card in the parent dashboard) instead of a real account/password. On the app's home screen they choose "View my account," enter the code, and see their balance and history — read only, no way to add or change transactions.

## 1. Create your database (Supabase — free)

1. Go to https://supabase.com, sign up, click **New project**.
2. Once it's created, open **SQL Editor** in the left sidebar → **New query**.
3. Paste the entire contents of `schema.sql` (included in this folder) and click **Run**.
4. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key — you'll need both in step 3.
5. Go to **Authentication → Providers** and make sure **Email** is enabled (it is by default). Optional: under **Authentication → Settings**, you can turn off "Confirm email" if you don't want the email-confirmation step when you sign up.

## 2. Get the code onto GitHub

1. Create a free GitHub account if you don't have one: https://github.com
2. Create a new empty repository (e.g. `family-bank`).
3. Upload this whole folder to it (easiest: on the repo page, drag-and-drop all the files, or use `git push` if you're comfortable with git).

## 3. Deploy to Vercel (free hosting)

1. Go to https://vercel.com and sign up using your GitHub account.
2. Click **Add New → Project**, pick your `family-bank` repo.
3. Before deploying, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = the Project URL from step 1
   - `VITE_SUPABASE_ANON_KEY` = the anon public key from step 1
4. Click **Deploy**. In about a minute you'll get a live URL like `family-bank-yourname.vercel.app`.

## 4. Use it

1. Open your new URL, choose "Parent sign in," and sign up with your own email/password.
2. Add a kid account, set an interest rate if you want one. A 6-character view code is generated automatically — it's shown on the kid's card.
3. Log deposits/withdrawals as they happen. Click "Apply monthly interest" once a month if you're using interest.
4. Give the code to your kid. From the home screen they choose "View my account," enter it, and can check their balance and history anytime — but can't change anything.

*If you already deployed before this feature existed:* run `migration_kid_view.sql` in the Supabase SQL Editor once, then redeploy the updated code (existing kids won't have a code yet — open the SQL Editor and run `update kids set kid_access_code = upper(substr(md5(random()::text), 1, 6));` to backfill one for each).

## Optional: custom domain

In Vercel, go to your project → **Settings → Domains** and add a domain you own (~$10–15/year from a registrar like Namecheap or Porkbun), or just keep the free `.vercel.app` URL — it works fine and is private unless you share the link.

## Local development (optional)

If you want to run it on your own computer first:

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and anon key
npm run dev
```

## How it works / what you own

- The frontend (this code) is 100% yours — no vendor lock-in, edit it however you like.
- Your data lives in your own Supabase project, in a real Postgres database you can export anytime (Table Editor → export CSV, or full pg_dump if you outgrow the free tier).
- Row Level Security ensures only you (the signed-in parent) can see or edit your kids' data.
- The free tiers of Supabase and Vercel are more than enough for a family app like this — no credit card required to start either one.
