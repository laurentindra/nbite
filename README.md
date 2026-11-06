# Night Bite

Night Bite is a surplus-food marketplace with a customer catalogue, checkout, favourites, customer-to-store chat, and a protected Food Partner workspace for managing package prices and stock.

**Database:** MySQL / MariaDB (XAMPP locally, or a managed MySQL server when hosted). SQLite is no longer used.

## Project structure

The front end is plain HTML, CSS and JavaScript with no build step. Each language has one job:
HTML holds the real markup and text, CSS holds all of the design, and JavaScript holds only logic.

```
public/
  index.html              Customer page (header, footer, tab bar). server.js also serves it at / and /customer.html
  food-partner.html       Food Partner entry page (same app, opens on the partner portal)
  pages/                  One HTML file per screen (home, explore, deal, checkout, orders, ...)
  components/             Reusable HTML pieces (deal card, ticket, filter panel, modals, empty states, ...)
  assets/
    css/                  main.css imports base, header, hero, cards, buttons, explore, ... views
    img/                  icons.svg and mascot.svg sprites, food/*.svg illustrations
    js/
      main.js             Entry point
      config.js           Constants, route groups, titles, runtime messages
      state.js, api.js    UI state and the fetch wrapper
      router.js           Hash router and the single render pipeline
      data.js             Loads data per route and handles API errors
      actions.js          Click actions (data-a="...")
      forms.js            Form submissions and input listeners
      polling.js          Inbox auto-refresh
      lib/                dom helpers, formatting, HTML partial loader
      components/         Cards, ticket, filters, chat, overlays, toast, shell
      views/              One module per screen, fills a page template with data
```

How the HTML and JS connect: partials in `pages/` and `components/` are loaded once and cloned.
JavaScript only fills them through small attributes: `data-field` (text), `data-if` (show/hide),
`data-list` / `data-slot` (where to insert child nodes) and `data-a` (click action).

## 1. Requirements

- Node.js 22.13 or newer
- XAMPP with MySQL/MariaDB enabled (Apache is only needed to open phpMyAdmin)
- npm (included with Node.js)

## 2. Set up MySQL using XAMPP

1. Open the XAMPP Control Panel.
2. Start **MySQL**. Start **Apache** as well if you want to use phpMyAdmin through your browser.
3. Open http://localhost/phpmyadmin.
4. Select **Import** and choose `database/nightbite_mysql.sql` from this project.
5. Click **Import** / **Go**. The SQL file creates the `nightbite` database and its 11 tables.

The server automatically inserts the nine sample restaurants and their sample packages the first time it starts, as long as the `merchants` table is empty. This MySQL setup starts with a fresh database; any accounts, orders or messages from an older local SQLite file are not copied automatically.

If MySQL uses a password for the `root` user, enter that password in `.env` below.

## 3. Configure and run the website

Open PowerShell in the `night-bite-web` project folder. Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Open `.env` and confirm these local XAMPP settings:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=nightbite
DB_SSL=0
PORT=3000
NB_TZ=Asia/Jakarta
NB_SECURE=0
```

Install the Node.js dependencies once:

```powershell
npm install
```

Start the website:

```powershell
npm start
```

Open http://localhost:3000 for customers or http://localhost:3000/food-partner.html for the Food Partner portal. Keep the PowerShell window open while using the website. This project is a Node.js website; it does **not** go inside XAMPP's `htdocs` folder. XAMPP provides the MySQL database and phpMyAdmin interface.

## 4. Check the database in phpMyAdmin

Open http://localhost/phpmyadmin, select the `nightbite` database, and use **Browse** on these tables:

| Table | Data stored |
| --- | --- |
| `users` | Customer accounts |
| `sessions` | Customer login sessions |
| `merchants` | Restaurant/store profiles |
| `listings` | Food packages, regular prices, promo prices and stock |
| `orders` | Customer reservations and checkout totals |
| `partner_users` | Food Partner accounts and store ownership |
| `partner_sessions` | Food Partner login sessions |
| `chats` | Customer-to-store conversations |
| `chat_messages` | Messages sent by customers and sellers |
| `favorites` | Customer favourite packages |
| `meta` | Daily stock reset marker |

To test that MySQL is being used, register a customer in the website and refresh the `users` table in phpMyAdmin. Place an order and check `orders`. Change a package price through the Food Partner dashboard and check `listings`. Send a chat message and check `chat_messages`.

## 5. Main website flows

### Customer

1. Browse all sample packages at any time. Packages remain visible outside pickup hours; checkout is only allowed before the pickup window ends and while stock remains.
2. The regular price is shown by default. The promo price appears only when the store enables it.
3. Register or log in to reserve packages, view orders, manage favourites and contact a store.
4. Customer messages are available from **Messages**.

### Food Partner

1. Open **Food partner?** in the header or **Food Partner portal** in the footer.
2. Register with the employee name, new store name, store address, area, work email and password. The store profile is created during registration.
3. Manage regular prices, promo pricing and daily quantities in the protected store dashboard.
4. Open the inbox to read and answer customer messages. A store account can only access its own listings and conversations.


## 6. Hosting preparation

The application supports both the local `DB_*` variables above and common hosted MySQL variables (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`). For a typical deployment:

1. Deploy this Node.js project to a host that supports a persistent Node.js web service.
2. Create a MySQL database on the same hosting provider, or use an external managed MySQL service.
3. Import `database/nightbite_mysql.sql` into that hosted database, or let the app create its tables after the database itself has been created.
4. Add the database connection details as environment variables in the host dashboard. The app accepts `DB_*`, common `MYSQL*` variables, or a `DATABASE_URL` / `MYSQL_URL`. Set `DB_SSL=1` only if the provider requires TLS. Do not upload `.env` or commit real passwords to GitHub.
5. For a public deployment, add email verification and administrator approval before allowing new store accounts. Set `NB_SECURE=1` when the site is served over HTTPS.
6. Deploy using `npm install` during build and `npm start` to run.

The database must allow connections from the application host. Do not expose the MySQL port publicly unless the provider specifically requires it; use its private network/managed connection settings where available. Make regular database backups.

## 7. Important limitations

- The nine initial stores and food packages are fictional sample data. Food Partner accounts can manage the sample packages assigned to their store. A production admin onboarding flow for adding real stores and new package records is not included yet.
- Checkout currently supports **Pay at pickup** only. Online payment requires integration with a provider such as Midtrans or Xendit.
- Order pickup confirmation does not yet have a store-side UI.
- Email verification and password reset are not implemented.
- Distances and map positions are sample values.

## Environment variables

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | empty |
| `DB_NAME` | MySQL database | `nightbite` |
| `DB_SSL` | Enable TLS for MySQL when required (`1` or `0`) | `0` |
| `DATABASE_URL`, `MYSQL_URL` | Alternative full MySQL connection URI | not set |
| `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` | Hosted-provider MySQL alternatives | not set |
| `PORT` | Node.js HTTP port | `3000` |
| `NB_TZ` | Pickup-window time zone | `Asia/Jakarta` |
| `NB_SECURE` | Set to `1` behind HTTPS to mark cookies Secure | `0` |
| `NB_ADMIN_KEY` | Optional secret for the admin collect API | empty |

## Project files

- `server.js` — Node.js web server, API routes and authentication
- `db.js` — MySQL connection pool, schema setup, sample data and transaction helpers
- `database/nightbite_mysql.sql` — importable MySQL schema for phpMyAdmin / hosting
- `.env.example` — local configuration template
- `public/` — customer and Food Partner website interface


## Separate page entry points
- Customer: `/customer.html` (also `/`)
- Food Partner: `/food-partner` or `/food-partner.html`
- Both pages share the same API and MySQL database. Shared application behaviour is in `public/app.js`; shared design is in `public/styles.css`. Food Partner has its own CSS entry point at `public/food-partner.css`.

Food Partner registration now creates a new merchant record from the submitted store name, address and area. It no longer asks staff to select an existing store or enter an invite code. Use a unique work email and a password of at least 8 characters.

### Payments and location
Cash-at-pickup remains available. QRIS live payment requires a payment gateway merchant account and valid server/client keys (for example Midtrans); the app must not pretend to accept a real payment without those credentials and webhook verification. Set the `MIDTRANS_*` variables only after the merchant account is approved. Browser location uses the Geolocation API and requires user permission and HTTPS when hosted; local development on `localhost` is supported.


## 8. Payments and location

- Cash at pickup is available without a payment provider. QRIS live payments are not activated by default. To accept real QRIS payments, configure a verified Midtrans merchant account, server/client keys, webhook notification URL and production approval; never use a static QR image as proof of payment.
- Browser location requires user permission and HTTPS in production (localhost is allowed for local testing). The app can request the current coordinates, but distance-based sorting/routing still needs a geocoding/maps provider and its API key.
- Customer and Food Partner have separate HTML entry pages (`customer.html` and `food-partner.html`), separate page entry scripts, shared application logic (`app.js`) and shared styling (`styles.css`). Dynamic screens are currently rendered by the shared JavaScript layer.
