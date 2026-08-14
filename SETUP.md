# Wishes — Shared Wish List
## Setup Guide

Same pattern as Cart and the waypoint planner: Supabase for the database, GitHub for the code, Netlify for hosting. ~15 minutes.

---

## Step 1 — Create the Supabase project

1. Go to supabase.com and sign in (or create a free account).
2. Click **New project**. Name it something like `wishes`. Pick any region and set a database password (save it somewhere, you won't need it day-to-day).
3. Once the project finishes provisioning, open the **SQL Editor** (left sidebar) and run this:

```sql
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  item text not null,
  got boolean not null default false,
  created_at timestamptz not null default now()
);

alter table wishlist_items enable row level security;

create policy "Allow all access"
on wishlist_items
for all
using (true)
with check (true);

alter publication supabase_realtime add table wishlist_items;
```

This creates the table, turns on row-level security, and adds a wide-open policy so the app can read/write freely and adds the table to realtime so changes sync live. Since it's a family list with no login, this is the same open-access tradeoff the grocery list uses — anyone with the URL can read and edit it.

4. Go to **Project Settings → API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key

---

## Step 2 — Add your keys to the app

1. Open `config.js` in the files below.
2. Replace `YOUR_SUPABASE_URL` with your Project URL, and `YOUR_SUPABASE_ANON_KEY` with your anon public key. Keep the quotes.

```js
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

---

## Step 3 — Push to GitHub

1. Go to github.com and create a new repository, e.g. `wishlist-app`. Public or private both work.
2. Upload all four files (`index.html`, `style.css`, `app.js`, `config.js`) to the repo — either drag-and-drop on the GitHub web UI ("Add file → Upload files") or via git if you prefer the command line.
3. Commit.

---

## Step 4 — Deploy on Netlify

1. In Netlify, click **Add new site → Import an existing project**.
2. Choose **GitHub**, authorize if prompted, and select the `wishlist-app` repo.
3. Leave the build command and publish directory blank — this is a static site, nothing to build.
4. Click **Deploy**.

Netlify will give you a URL like `random-name-123abc.netlify.app`. That's the link to share with Loey, your mom, or anyone else who'll use the list.

Because it's connected to GitHub (not a manual folder drag), any future edits you push to the repo will auto-deploy.

---

## Using it

- Anyone with the link can add a wish: enter who it's for and what they want, hit Add.
- Items group automatically into a card per person.
- Tap the circle to mark something as gotten (crosses it out, moves it to the bottom of that person's list). Tap the × to remove it entirely.
- Since it's realtime, if two people have the page open at once, both see changes instantly — same as the grocery list.

## About the "down the road" use

The schema is generic enough (`person` + `item` + `got`) that it works for actual grocery/errand nudges too, not just gifts — e.g. "Loey — hairspray" can sit next to "Loey — birthday: Ooala" without anything breaking. If it grows into more than gift-tracking, the easiest add later is a `type` or `category` column (e.g. "gift" vs "errand") so you can filter — happy to add that when/if it's actually useful rather than building it in now.
