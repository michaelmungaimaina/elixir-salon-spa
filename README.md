# Elixir Salon & Spa

The Elixir Salon & Spa website with **built-in online booking** and a full content-management admin panel.
Clients book a service without leaving the site; you manage appointments, prices, photos, offers and wording from `/admin`.

- **Public site** – `/`  ·  **Admin panel** – `/admin`  ·  **Client "manage my booking" page** – `/booking/<secret link from their email>`
- **Stack** – Node.js · Express · MySQL/MariaDB. No build step, no front-end framework.

---

## 1. Run it

```bash
npm install
# edit .env (database details; the mail settings are already filled in)
npm start                 # http://localhost:3000
```

On first start the app creates its tables and fills the site with the original content. Existing data is kept (see *Upgrading*).
Open **`/admin`** and create the owner account on the "Welcome" screen. Locked out later? `npm run reset-admin -- you@example.com NewPassword123`

### Environment (`.env`)
| Variable | Purpose |
|---|---|
| `SITE_URL` | Public address, e.g. `https://elixirsalonandspa.co.ke` (used in email links and social previews) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL / MariaDB. The database is created if missing |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` | Mail server – `mail.elixirsalonandspa.co.ke`, port `465`, secure `true` |
| `EMAIL_USER` `EMAIL_PASS` | The mailbox the site sends **from** – `info@elixirsalonandspa.co.ke` |
| `SMTP_REJECT_UNAUTHORIZED` | Set to `false` only if the mail host's certificate does not match its hostname |

> `.env` holds the mailbox password. It is git-ignored – never commit or share it. Because the password was shared in a chat, consider changing it in cPanel once everything works, then update `.env`.

---

## 2. Email: who sends, who receives

| What | Address |
|---|---|
| Sent **from** (booking confirmations, reminders, form replies) | `info@elixirsalonandspa.co.ke` |
| Client presses **Reply** → arrives at | `admin@elixirsalonandspa.co.ke` (Admin > Email > Reply-To) |
| Team alerts (new booking, message, application, review) go to | `admin@elixirsalonandspa.co.ke` (Admin > Email > Send team alerts to) |

The app only needs to *log in* as `info@` (outgoing SMTP). Replies and alerts simply land in the `admin@` mailbox, which you read as usual (webmail / IMAP / POP3). Team alerts use the client's address as Reply-To, so replying to an alert writes straight back to the client.

**Check it works:** Admin > **Email** shows "Email is connected" (or the exact error), lets you send a test, and lists the last 40 deliveries with their result. If email is down, bookings still succeed – the failure is just recorded there.
Troubleshooting: *connection timeout* → ask your host to allow outgoing port 465 (or try port 587 with `SMTP_SECURE=false`); *certificate/hostname error* → set `SMTP_REJECT_UNAUTHORIZED=false`; *authentication failed* → check the mailbox password.

---

## 3. How booking works

**For clients** – press any *Book* button (header, hero, each service in the price list, offers, footer, the mobile action bar) or use the "Book in under a minute" bar on the home page:
1. choose services (several can be combined in one visit) →
2. see live availability: the first free day is pre-selected, then pick a time (optionally a specific specialist) →
3. enter name, phone and email → instant confirmation (or "request received" if you require approval).

They get an email with the details, a **calendar invite (.ics)**, and a private link to **reschedule or cancel** until the cut-off you set. A reminder email goes out before the visit (default 24 h). The booking can never be double-booked, even when several clients tap the same slot at once.

**Share a direct link** – `https://yoursite/?book=1` opens the booking window; `…/?book=1&service=12` opens it with service #12 chosen. Use it in Instagram/TikTok bios, WhatsApp, QR codes.

**For you (Admin > Bookings)**
| Page | What it does |
|---|---|
| **Appointments** | *Day schedule*: a column per specialist, colour-coded by status, closures shown, click an empty slot to add a booking. *All appointments*: search / filter list. Open any booking to confirm, decline, cancel (with a reason emailed to the client), reschedule, mark completed / no-show, send a reminder, WhatsApp or call the client, add a private note |
| **Schedule & hours** | Opening hours per weekday (these also feed the Contact section and footer), time between start times, minimum notice, how far ahead clients can book, clean-up time, cancellation cut-off, reminder timing, instant confirmation vs approval, a master on/off switch, and all booking-window wording |
| **Specialists** | The people (or chairs) who can serve clients **at the same time** – the number of active specialists is your capacity. Set working days, which service groups each can perform, and whether clients may choose them. The site starts with four unnamed workstations: rename them to real people, or leave them and clients simply see "Any available" |
| **Closures & time off** | Block public holidays, training, leave or a lunch break for the whole salon or one person. You're warned if existing appointments fall inside |
| **Services** | Each service has *Minutes* (how much calendar time it uses) and a *Bookable* switch. **Durations that came with the site are sensible estimates – please review them.** |

Prices shown are estimates (ranges show "From"); the final price is confirmed at the salon. Payments are not taken online.

---

## 4. Everything else in the admin

Edit all wording, photos, prices, gallery, promotions (with dates and icons), job openings, reviews (moderated), messages and CV applications, media library, brand colours, SEO, navigation, the **404 page** (Navigation & 404: heading, message, photo, buttons), team accounts and email templates. *Owner* can do everything; *Editor* cannot change team or email settings.

---

## 5. Deploying

- Node 18+ and MySQL 5.7+ / MariaDB 10.3+. Run behind HTTPS (cookies become `Secure` automatically) with a process manager (`pm2 start server/server.js --name elixir`).
- Keep `public/media/` (uploads) and `uploads/` (private CVs) on persistent storage and back them up, together with the database.
- The server keeps the reminder scheduler running, so it must stay up (not a serverless/static host). Times are handled in the salon's time zone (Africa/Nairobi) wherever the server is hosted.

## 6. Security

Passwords are hashed (scrypt); sessions are signed `HttpOnly`/`SameSite=Strict` cookies; every admin write needs a session and a CSRF header; login, forms and booking endpoints are rate-limited with a honeypot; client manage links are 144-bit random secrets, `noindex`, and excluded from `robots.txt`; a client can hold at most a few upcoming bookings (setting) so one person cannot hog the calendar; all text is escaped on output and links are validated; CVs are never served publicly.

## 7. Upgrading from the earlier version

Start the new code on your existing database. New tables and columns are added; **nothing is deleted**. Services receive default durations, promotions lose their emojis in favour of icons, mail alerts move to `admin@`, and four starter workstations are created. Settings you already edited are never overwritten – only brand-new settings are added.

## 8. Layout

```
server/  server.js (site, SEO)  admin.js  booking.js (availability engine)  booking-public.js  booking-admin.js
         booking-mail.js  mailer.js  scheduler.js  notfound.js  db.js  seed-data.js  auth.js  timeutil.js  util.js
public/  index.html  css/site.css  css/booking.css  css/notfound.css  scripts/site.js  scripts/booking.js
         admin/ (plain JS panel)   fonts/ vendor/fa/ (self-hosted)   resources/ (photos)   media/ (uploads)
uploads/ private CVs
```
