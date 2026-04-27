# Matchmake Deployment Checklist

Use this checklist to deploy Matchmake / ScrimGG to Vercel from GitHub.

## 1. Confirm Local Environment

Create or confirm `.env.local` exists locally:

```env
NEXT_PUBLIC_SUPABASE_URL=https://urrnrcdxekhovsemeuly.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Never commit `.env.local`.

## 2. Verify The Build

```bash
npm run build
```

Fix any build-blocking errors before deploying.

## 3. Initialize Git If Needed

```bash
git init
git branch -M main
```

## 4. Add The GitHub Remote If Needed

```bash
git remote add origin https://github.com/Pogchew/Matchmake.git
```

If a remote already exists, confirm it points to the correct repository before changing it.

## 5. Commit

```bash
git add .
git commit -m "Prepare shippable MVP auth and scrim posting"
```

## 6. Push

```bash
git push -u origin main
```

Do not force push unless you intentionally want to overwrite remote history.

## 7. Import In Vercel

1. Go to [Vercel New Project](https://vercel.com/new).
2. Import `https://github.com/Pogchew/Matchmake`.
3. Keep the framework preset as Next.js.

## 8. Add Vercel Environment Variables

In Vercel Project Settings, add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://urrnrcdxekhovsemeuly.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 9. Deploy

Click **Deploy**.

After deployment, verify:

- `/login` loads.
- `/signup` creates a Supabase Auth user.
- Protected pages redirect logged-out users to `/login`.
- Logged-in users can access `/`, `/org`, `/requests`, `/calendar`, `/team`, `/chat`, and `/scrims/[id]`.
- Scrim Board can fetch open scrim listings.
- Posting a scrim creates a new `scrim_requests` row.
