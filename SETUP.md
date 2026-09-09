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

## Updating an existing "Wishes" project

**If you haven't already added surprise/notes/occasion/priority support**, run this in the SQL Editor first (skip if you already did):

```sql
alter table wishlist_items add column if not exists surprise boolean not null default false;
alter table wishlist_items add column if not exists note text;
alter table wishlist_items add column if not exists occasion text;
alter table wishlist_items add column if not exists priority boolean not null default false;
```

**For the "Manage people" admin panel**, run this too (skip if you already did):

```sql
create table restricted_identities (
  person text primary key,
  created_at timestamptz not null default now()
);

alter table restricted_identities enable row level security;

create policy "Allow all access"
on restricted_identities
for all
using (true)
with check (true);

alter publication supabase_realtime add table restricted_identities;
```

Then in `config.js`, replace `ADMIN_PIN`'s value (`'CHANGE_ME'`) with a PIN you and Loey will remember. **Heads up:** this PIN lives in plain text in the site's code — it's a soft gate to stop casual/accidental changes, not real security. Don't rely on it to keep something from a person determined to look at the page source.

Then replace `index.html`, `style.css`, `app.js`, and `config.js` in your GitHub repo with the latest versions and commit; Netlify redeploys automatically.

**What's new in this round:**
- **Your own list stays honest but blind.** If you add an item under your own name (e.g. Ramon adds "gift card" for himself), you can always see it and delete it whenever you want — but you'll never see whether anyone else has claimed or checked it off. It never shows a strikethrough, never moves to History, for you specifically. Everyone else viewing the app sees its real status normally, so nobody double-buys it.
- **"Skip for now"** — the identity prompt now has a low-commitment out for anyone who just wants to look without picking a name. It'll ask again next visit rather than forcing a permanent choice.
- **Surprise is now front-and-center** — no longer buried under "Add details." It's a highlighted checkbox right under the main add row, and it defaults itself sensibly: checked when you're adding for someone else, unchecked when you're adding to your own list.
- **Admin PIN + Manage people (⚙ in the header)** — enter the shared PIN to open a checklist of everyone who's ever appeared on the board. Uncheck someone and they disappear from the "who are you" picker entirely (including blocking them from typing their own name in) — while staying completely normal as a gift recipient. Check them back on any time. Want it to just be a tool for you and Loey? Uncheck everyone else; they'll all still show up as people you're shopping for.

---

## Using it

- The first time anyone opens the app on a device, it asks "Who's looking at Wishes?" — pick a name (or "Just show me everything" if privacy doesn't matter for that device). That choice is remembered on that device going forward; tap "Viewing as" in the header any time to change it.
- Adding an item: pick or type a person, type what they want, hit Add. Tap "+ Add details" to optionally attach a note or link, tag an occasion, mark it a top want (⭐), or check "Keep this a surprise from them" — which hides that item from that person's view on their own device.
- Tap the circle to mark something gotten — it disappears from the main board and moves into History.
- **History** (small link in the header) shows everything marked gotten, still respecting surprise privacy. Each entry has an Undo (puts it back on the active list) and an × (deletes it individually). "Clear history" wipes everything currently visible to you in one go, with a confirmation first.
- Items group automatically into a card per person, sorted with ⭐ top wants first.
- Since it's realtime, if two people have the page open at once, both see changes instantly — same as the grocery list.
- The occasion filter (appears once you've tagged at least one item) lets you narrow the board down to just "Christmas," just "Birthday," etc.

## About the "down the road" use

The schema is generic enough (`person` + `item` + `got`) that it works for actual grocery/errand nudges too, not just gifts — e.g. "Loey — hairspray" can sit next to "Loey — birthday: Ooala" without anything breaking. If it grows into more than gift-tracking, the easiest add later is a `type` or `category` column (e.g. "gift" vs "errand") so you can filter — happy to add that when/if it's actually useful rather than building it in now.
