# Honeyhollow

A free, friendly city-builder that runs in any modern browser. Build homes and shops, grow crops, run a harbor and a railway, visit neighbors and help each other.

- **Free, forever.** No purchases, no premium currency, no ads, no loot boxes, no trackers.
- **Plays without an account.** Your city is saved in your browser. The online part (accounts, neighbors, cloud saves) is optional.
- **Runs on simple web hosting.** The game is plain files; the optional online part is PHP + MySQL. Made for Hostinger shared hosting, but any host with PHP 8.2+ and MySQL/MariaDB works.

---

## Contents

1. [Try it on your computer](#1-try-it-on-your-computer)
2. [Put it online on Hostinger (step by step)](#2-put-it-online-on-hostinger-step-by-step)
3. [Updating the game later (without losing anyone's city)](#3-updating-the-game-later)
4. [Installing in a subfolder, or without the online part](#4-installing-in-a-subfolder-or-without-the-online-part)
5. [Troubleshooting](#5-troubleshooting)
6. [For developers](#6-for-developers)
7. [Credits and licenses](#7-credits-and-licenses)

---

## 1. Try it on your computer

You need [Node.js](https://nodejs.org/) (the "LTS" version). Then, in a terminal inside this folder:

```bash
npm install
npm run dev
```

Open the address it prints (for example `http://localhost:5173`). That's the full game, playable as a guest.

While you run `npm run dev` there is a small **DEV** button on the right side of the screen: it skips time (to test crops, rent and energy) and previews the time of day. It never appears in the real, published game.

---

## 2. Put it online on Hostinger (step by step)

You will:

1. make the upload folder on your computer,
2. set up PHP and a database in hPanel,
3. upload the files,
4. add your settings file,
5. switch on HTTPS and a daily cleanup job.

It takes about 20 minutes. Menu names below are from Hostinger's hPanel; they may be worded slightly differently on your account.

### Step 1 - Make the upload folder

On your computer, in this project folder:

```bash
npm install
npm run package
```

This creates a folder called **`upload/`** containing exactly what goes on your website:

```
upload/
  index.html, privacy.html, sw.js, manifest.webmanifest, icons/, assets/   <- the game
  .htaccess                                                                 <- web server settings (hidden file)
  api/                                                                      <- the online part (PHP)
```

The command also prints how big the first download is (about 0.5 MB).

### Step 2 - Choose PHP 8.3

hPanel → **Websites** → your site → **Dashboard** → **Advanced** → **PHP Configuration** → choose **PHP 8.3** → **Update**.

(8.2 or newer works. Make sure the **pdo_mysql** and **mbstring** extensions are ticked; they are by default.)

### Step 3 - Create a database

hPanel → **Databases** → **Management** (or "MySQL Databases"):

1. Under **Create a New MySQL Database And Database User**, type a database name (for example `honeyhollow`), a username (for example `hhuser`) and a strong password.
2. Click **Create**.
3. Write down the **full** database name and username shown in the list. Hostinger adds a prefix, so they look like `u123456789_honeyhollow` and `u123456789_hhuser`. Keep the password too.

### Step 4 - Create the tables (phpMyAdmin)

1. In the same Databases page, click **Enter phpMyAdmin** next to your new database.
2. Click your database in the left column, then the **Import** tab.
3. Click **Choose File** and pick **`server/schema.sql`** from this project.
4. Click **Import** (at the bottom). You should see "Import has been successfully finished" and ten tables starting with `hh_`.

The file only creates tables (it never deletes anything), so importing it twice is harmless.

### Step 5 - Upload the files

Upload **everything inside `upload/`** into your site's **`public_html`** folder. Pick one way:

**A. File Manager (easiest)**

1. On your computer, zip the *contents* of `upload/` (open the folder, select everything including `.htaccess` - turn on "show hidden files" if you can't see it - and compress it to `honeyhollow.zip`).
2. hPanel → **Files** → **File Manager** → open `public_html`.
3. Click **Upload**, choose `honeyhollow.zip`, then right-click it → **Extract** → extract into `public_html`. Delete the zip afterwards.

**B. FTP (FileZilla)**

1. hPanel → **Files** → **FTP Accounts** shows the host, username and password.
2. Connect with FileZilla, open `public_html` on the right, and drag everything from `upload/` into it. In FileZilla, enable **Server → Force showing hidden files** so `.htaccess` files are copied too.

**C. Git (for developers)**

hPanel → **Advanced** → **Git** can deploy a repository into `public_html`. Commit the *contents* of `upload/` to a separate deployment repository or branch and deploy that, since `public_html` must contain the built files, not the source code.

When you're done, `public_html` should contain `index.html`, the `assets` and `api` folders, and a `.htaccess` file.

### Step 6 - Add your settings file (config.php)

1. In File Manager open `public_html/api/_private/`.
2. Right-click **`config.sample.php`** → **Copy** → name the copy **`config.php`** (same folder).
3. Right-click `config.php` → **Edit** and fill in:
   - `'name'` → your full database name (`u123456789_honeyhollow`)
   - `'user'` → your full database username (`u123456789_hhuser`)
   - `'pass'` → the database password
   - `'secret'` → a long random string of at least 32 letters and numbers (for example from [random.org/strings](https://www.random.org/strings/)). Never share it.
   - Leave `'host' => 'localhost'` and `'port' => 3306` as they are on Hostinger.
4. **Save**.

The `_private` folder is locked against web visitors by `.htaccess`, and the file itself prints nothing, so nobody can read your password.

### Step 7 - Switch on HTTPS

hPanel → **Security** → **SSL** → install the free SSL certificate for your domain if it isn't already active. The game's `.htaccess` then sends every visitor to `https://` automatically, which keeps sign-ins private.

### Step 8 - Check that it works

- Open your website. The game should load and play.
- Open `https://your-domain/api/index.php?a=session`. You should see text starting with `{"ok":true`.
- In the game: **Settings → Account → Create account**. If it works, the online part is set up.

### Step 9 - Daily cleanup (cron job)

This removes expired sign-ins and old help/gift records once a day.

hPanel → **Advanced** → **Cron Jobs** → **Create a new cron job**:

- Type: **PHP** (or "Custom" command)
- Command (replace the path with yours; File Manager shows it at the top when you open `public_html`):

  ```
  /usr/bin/php /home/u123456789/domains/your-domain.com/public_html/api/_private/cron/cleanup.php
  ```

- Schedule: **once a day** (for example minute `15`, hour `4`, every day).

That's it - your city-builder is live!

---

## 3. Updating the game later

Players' cities are safe during updates: guest cities live in each player's browser, and accounts and cloud saves live in your database. To update:

1. Get the new version of this project and run `npm run package` again.
2. Upload the contents of the new `upload/` folder over the old files in `public_html`, replacing them. The package never contains `config.php`, so your settings stay as they are.
3. Only if the release notes say so, import the new `server/schema.sql` in phpMyAdmin (it only adds what is missing).
4. Optionally delete old files in `public_html/assets/` that the new version no longer uses (their names have changed; they do no harm if left).

Players get the new version the next time they open the game. Older saves are upgraded automatically.

---

## 4. Installing in a subfolder, or without the online part

**In a subfolder** (for example `https://your-domain.com/games/honeyhollow/`): upload the contents of `upload/` into that folder instead of `public_html`. Everything uses relative paths, so no settings change. Use that folder's path in the cron job.

**Without the online part:** upload everything except the `api` folder and skip steps 3, 4, 6 and 9. The game then runs in guest mode only (cities saved in each player's browser), and it says so where accounts would appear.

**Somewhere else for the API:** if you put the API in a different folder, change `<meta name="honeyhollow-api" content="api/">` in `index.html` to that folder (relative to the page).

---

## 5. Troubleshooting

| What you see | What to check |
| --- | --- |
| The page is blank or shows a list of files | `index.html` must be directly in `public_html` (not in `public_html/upload/`). |
| The game says it "runs without a server" or "couldn't reach the server" | Open `/api/index.php?a=session`. A 404 means the `api` folder wasn't uploaded next to `index.html`; anything else is explained by the rows below. |
| `{"ok":false,"error":"config"}` | `api/_private/config.php` is missing, or its `secret` is still the sample text or shorter than 32 characters. |
| `{"ok":false,"error":"database"}` | Wrong database name, user or password in `config.php` (remember the `u123456789_` prefixes), or the tables weren't imported (step 4). |
| `{"ok":false,"error":"php_version"}` | PHP is older than 8.2 - choose PHP 8.3 (step 2). |
| New accounts can't be created | Check `'allow_register' => true` in `config.php`. Each connection can create at most 6 accounts an hour. |
| Changes don't show after an update | Reload the page once; the game checks for the new version on every start. |

Your data and privacy: see `privacy.html` on your site (linked from Settings in the game).

---

## 6. For developers

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload (and the DEV time-skip button). |
| `npm run build` | Type-checks and builds the game into `dist/`. |
| `npm run package` | Builds, then assembles `upload/` for hosting (see above). |
| `npm test` | Runs the simulation unit tests (Vitest). |
| `npm run typecheck` | TypeScript in strict mode, no output. |
| `npm run serve:api` | Runs the PHP API locally with PHP's built-in server on port 8090 (needs PHP 8.2+ on your PATH and a local MySQL/MariaDB). |
| `npm run test:api` | Runs the API smoke test against that server (accounts, saves, friends, 5 helps a day, gifts, franchises, deletion). |

For the local API, create `server/api/_private/config.php` from the sample (it is git-ignored) pointing at your local database, and import `server/schema.sql`. `npm run dev` forwards `/api` to `http://127.0.0.1:8090` (change it with the `HH_API_URL` environment variable).

To redraw the PNG app icons after changing the logo: `node scripts/make-icons.mjs`.

### How it fits together

- `src/sim/` - the game rules as pure TypeScript (state + action → new state). All timers are timestamps, so time away is fast-forwarded exactly. Fully unit-tested.
- `src/data/` - all content as JSON: items, crops, goals, collections, levels, balance numbers, NPC towns, shipping, seasonal events, achievements and every piece of UI text (`strings/en.json`).
- `src/art/` - every picture is drawn by code (no image files), including night lighting layers.
- `src/render/` - the Phaser 4 scene: the isometric city, walkers, cars on smooth lane routes, day and night, and "sharp zoom" (on-screen art is redrawn at the zoom's resolution).
- `src/ui/`, `src/game/` - the HTML interface, the controller, neighbors, the online client and franchises.
- `server/` - the optional PHP API (`api/`), the database schema and the API smoke test.
- `deploy/` - `.htaccess` files copied into `upload/` by `npm run package`.

### Seasonal events

Add an event to `src/data/events.json` with a date window (`"from": "MM-DD"`, `"to": "MM-DD"`), its items, goals and a collection. Its decorations appear in the Build menu's Seasonal tab only while it runs, and about half of all finds come from its collection during that time.

---

## 7. Credits and licenses

- Game code, art and text: original work for this project.
- [Phaser](https://phaser.io/) (MIT license) for rendering.
- [Fredoka](https://fonts.google.com/specimen/Fredoka) font by Milena Brandão (SIL Open Font License), bundled with the game.
