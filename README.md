# Elixir Salon & Spa

The Elixir Salon & Spa website with a full content-management admin panel.
Every word, price, photo, link, offer and review on the public site is edited from `/admin` – no code changes needed.

- **Public site** – `/` (mobile-first, same emerald / gold / umber brand as before)
- **Admin panel** – `/admin`
- **Stack** – Node.js · Express · MySQL/MariaDB (as before). No build step, no front-end framework.

---

## 1. Run it

```bash
npm install
cp .env.example .env      # then fill in your database details
npm start                 # http://localhost:3000
```

On first start the app creates every table it needs and fills the site with the content that was on the original page.
Existing data in your old tables (`contact_data`, `ratings`, `applications`) is kept – see *Upgrading* below.

### Create your admin account
Open **`/admin`**. The very first time, you'll see a "Welcome! Let's begin" screen to create the **owner** account.
(Or set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` and it is created on start.)
Locked out later? `npm run reset-admin -- you@example.com NewPassword123`

### Environment (`.env`)
| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default 3000) |
| `SITE_URL` | Public address, e.g. `https://elixirsalonandspa.co.ke` (used for Google/WhatsApp previews & sitemap) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL / MariaDB connection. The database is created if missing |
| `EMAIL_USER` `EMAIL_PASS` | Gmail address + **App Password** for outgoing mail. Use `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` for another provider |

Email is optional: without it everything still works and messages land in the admin inbox.

---

## 2. Using the admin panel

| Menu | What you can do |
|---|---|
| **Dashboard** | New messages / applications / reviews at a glance, 14-day activity, recent changes |
| **Home · About · Booking · Contact · Privacy** | Edit all wording, photos, buttons, stats, opening hours, social links, WhatsApp number |
| **Services** | Categories + price list. Edit prices inline (auto-saves), reorder, hide, change each category's photos |
| **Gallery** | Add / remove / reorder / hide photos and videos, add captions |
| **Promotions** | Offer cards with optional start and end dates – they switch on and off by themselves |
| **Work with us** | Careers text plus the list of current openings (also feeds the application form) |
| **Testimonials** | New reviews wait for your approval; publish, hide, edit, reply publicly, or add your own |
| **Messages / Applications** | Inbox with search, status, private notes, reply by email / WhatsApp, CV download, CSV export |
| **Media library** | Upload once, reuse anywhere. Warns before deleting a file that's still in use |
| **Brand & SEO** | Name, logo, booking link, Google title/description, share image, the three brand colours |
| **Navigation** | Rename sections, hide from the menu, or remove a section from the site entirely |
| **Email** | Wording of the automatic replies and the alerts you receive |
| **Team / My account** | Add editors or owners, change your password |

**Roles** – *Owner*: everything. *Editor*: all content and inboxes, but not Team or Email settings.

---

## 3. Deploying

- Needs **Node 18+** and a **MySQL 5.7+/MariaDB 10.3+** database.
- Run behind HTTPS (nginx, Caddy, or your host's proxy). Cookies are marked `Secure` automatically when HTTPS is detected.
- Run with a process manager (`pm2 start server/server.js --name elixir`, systemd, or your host's Node app feature).
- **Keep these two folders on persistent storage and back them up:**
  - `public/media/` – photos and videos uploaded in the admin
  - `uploads/` – CVs sent by applicants (private; never served publicly)
- GitHub Pages cannot host this site any more because it now has a server and a database. The old `static.yml` workflow was removed for that reason.

---

## 4. Security notes

The previous admin had no real login and its API (including user passwords and every contact submission) was open to the internet. That is all replaced:

- Passwords are hashed with **scrypt**; sessions are signed, `HttpOnly`, `SameSite=Strict` cookies that expire after 12 hours and end when the password changes.
- Every admin write requires a session **and** a CSRF header. Login is rate-limited; public forms are rate-limited and have a honeypot field.
- All text is escaped on output; links are checked on save and on display (`javascript:` etc. is refused).
- Uploads are restricted by type and size. CVs live outside the public folder and are downloadable only by signed-in staff.
- The old `users` table (plain-text passwords) is **no longer used**. Once you've created your new owner account you can drop it: `DROP TABLE users;`

---

## 5. Upgrading from the earlier version

- Start the new code against your existing database. New columns are added to `contact_data`, `ratings` and `applications`; no rows are changed or deleted.
- Existing reviews stay **published**. Old CV files in `uploads/` keep working (including paths saved on Windows).
- The seven demo reviews and the default services are only added to a **new** site – never mixed into an existing reviews table.
- `/api/ratings` (GET), `/api/users`, `/api/applications` (GET) and similar open data endpoints no longer exist.

---

## 6. Project layout

```
server/
  server.js        public pages, SEO tags, form endpoints
  admin.js         admin API (auth, content, inbox, media, team)
  db.js            schema, safe migrations, first-run seed
  seed-data.js     the original site content (used once)
  auth.js mailer.js util.js config.js reset-admin.js
public/
  index.html  css/site.css  scripts/site.js     the public site
  admin/                                         the admin panel (plain JS, no build)
  fonts/ vendor/fa/                              self-hosted typefaces & icons
  resources/                                     original photos & videos
  media/                                         new uploads (git-ignored)
uploads/                                         applicant CVs (git-ignored, private)
```

### Small content fixes made while moving the copy into the database
"A Glimpse of Elixil" → "A Glimpse of Elixir"; "elixer" → "elixir" in the privacy policy email; the footer year is now automatic; the contact form accepts one-word names. All of it is editable in the admin if you prefer the original wording.
