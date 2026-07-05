# Product Catalogue

A self-hosted product catalogue app: browse products by category with filters,
manage categories/attributes/products from an admin panel, and configure the
site's branding — all backed by a lightweight CSV data store instead of a
database.

## Features

### Storefront (Products page)

- **Category navigation** as a top nav bar — top-level categories are always
  visible; hovering one reveals its subcategories in a dropdown. Categories
  with no children show no dropdown at all.
- **Attribute-based filtering** — any attribute marked "filterable" gets a
  filter in the sidebar automatically: checkboxes for text/select attributes
  (only showing values actually used by a product), min/max range inputs for
  number attributes.
- **Product grid** showing thumbnail, category, name, and price (respecting
  the "Show Price" flag — see below).
- **Product Detail Page (PDP)** — image slider/gallery, category badge,
  product name, brand ("by ..."), a highlighted price block, and every other
  attribute listed as a spec row, all pulled in automatically (see "System
  attributes" below).
- Fully responsive: the top nav and filters collapse into expandable panels
  on narrow screens.

### Category management

- Categories form a **tree** (unlimited nesting) via a parent/child
  relationship.
- **Drag and drop** in the Categories tab:
  - Drop onto the **top or bottom edge** of another category to reorder it
    as a sibling, positioned exactly there.
  - Drop onto the **middle** of another category to nest inside it.
  - Drag **sideways** (or drop in the tree's own indentation area) to pull a
    category back out to the top level.
  - A cycle guard (client- and server-side) prevents dropping a category into
    itself or one of its own descendants.
- Deleting a category is blocked (409) if it still has subcategories or
  products assigned to it — you have to clear those first.

### Attributes (EAV-style product fields)

- Every non-system product field is a user-defined **attribute** with a
  name, a type, and a filterable flag:
  - **Text** — filter by exact value (checkbox list).
  - **Number** — filter by min/max range.
  - **Image** — holds multiple images per product (see Photos below); never
    filterable.
  - **Boolean** — a yes/no toggle.
- Attributes can be renamed and have their filterable flag changed after
  creation; the type itself is locked once created (to avoid corrupting
  existing values).
- Duplicate attribute names are rejected (case-insensitive) on both create
  and rename.
- Deleting an attribute cascades: any value stored against it on existing
  products is removed too.

### System attributes

Four attributes are created automatically and get special treatment instead
of flowing into the generic spec list:

| Attribute  | Type    | Where it shows                                             |
| ---------- | ------- | ------------------------------------------------------------ |
| Brand      | text    | PDP subtitle ("by ...")                                       |
| Price      | number  | Highlighted price block on the PDP, and on each product tile |
| Photos     | image   | The image gallery/slider                                      |
| Show Price | boolean | Hidden control flag — set to "No" to hide a product's price   |

System attributes can't be deleted, and (except Brand/Price) can't be made
filterable, since filtering by them wouldn't mean anything to a shopper.
Any *other* attribute you add (text, number, image, boolean) automatically
appears in the PDP's spec list and, if marked filterable, in the sidebar —
no extra wiring needed.

### Products

- Add/edit a product: name, category, and any number of attribute rows.
- **Each attribute can only be used once per product** — once you've picked
  an attribute in one row, it disappears from every other row's dropdown
  (previously you could accidentally add the same attribute twice, which
  silently corrupted the stored value).
- **Image/Photos attribute**: upload multiple images; the first one is the
  thumbnail by default, but you can click the star on any other photo to
  make *it* the thumbnail instead.
- Deleting a product removes all of its attribute values along with it.

### System Configuration

A dedicated admin section for whole-app settings (as opposed to product
data):

- **App header title** — shown in the page header *and* the browser tab
  title.
- **Logo** — uploaded as an image, shown next to the title in the header.
- **Address** and **Telephone number** — shown under the title in the
  header.

### Authentication & security

Every editable action (add/edit/delete products, categories, attributes,
and settings) is **password protected**, enforced both in the UI and on the
server (so it can't be bypassed by calling the API directly):

- A single shared admin password, stored as a **scrypt hash** (salted,
  timing-safe comparison) — never in plaintext.
- The very first password lives only in a server-side text file
  (`server/data/password-seed.txt`) that's read once to seed the hash and
  never bundled into the frontend or served by any route.
- Logging in returns a session token (kept in `sessionStorage`), valid for
  12 hours, checked on every mutating request.
- **Change password** (in System Configuration) requires the current
  password, even though you're already logged in, and enforces an 8+
  character minimum.
- **Rate limiting** on login: 10 attempts per 5 minutes per IP.
- Browsing the catalogue itself (the Products page) is **not** gated —
  only the admin actions are.

### Look & feel

- Two-font system: **Plus Jakarta Sans** for headings, **Inter** for body
  text and controls (loaded from Google Fonts).
- Gradient brand identity (indigo → pink) applied consistently across
  headers, active nav states, and primary buttons.

## Tech stack

- **Frontend**: React 19 + Vite, plain CSS (no framework), React Context for
  auth state.
- **Backend**: Node.js + Express 5.
- **Storage**: CSV files on disk (see below) — no database server to run or
  configure.

## Data & storage

There's no database. All data lives in `server/data/*.csv`, read/written on
every request through a small hand-rolled store (`server/csvStore.js`):

| File                    | Contents                                    |
| ------------------------ | -------------------------------------------- |
| `categories.csv`         | id, name, parentId (row order = display order) |
| `attributes.csv`         | id, name, type, filterable, system          |
| `products.csv`           | id, name, categoryId                        |
| `productAttributes.csv`  | productId, attributeId, value (one row per value; an image attribute has one row per photo) |
| `settings.csv`           | key, value (site name, logo, address, phone) |
| `auth.json`              | the password hash (mode 600, gitignored)    |
| `password-seed.txt`      | the one-time default password (mode 600, gitignored) |

All of `server/data/` is excluded from git — it's runtime state, not source
code, and in particular the password hash should never end up in version
control.

## Getting started

Requires Node 20+.

```bash
# install frontend deps
npm install

# install backend deps
npm install --prefix server

# run both (two terminals)
npm run dev                    # frontend dev server, http://localhost:5173
npm run dev --prefix server    # API server, http://localhost:4000
```

The Vite dev server proxies `/api/*` to the backend, so just open
`http://localhost:5173`.

**First login**: the default admin password is `admin123` — change it
immediately from System Configuration once you're in.

## Building for production

```bash
npm install
npm run build   # builds the frontend into dist/
npm start        # runs the Express server, which now also serves dist/
```

In production, one Express server serves both the API and the built React
app from the same origin — no CORS, no separate static host needed. Just
make sure `server/data/` is on a **persistent disk/volume** wherever you
deploy, since that's where all product data and the password hash live.

## API overview

All routes are under `/api`. Everything except `GET /api/catalogue` and
`POST /api/auth/login` requires an `Authorization: Bearer <token>` header
from a prior login.

- `GET /api/catalogue` — categories, attributes, products, and settings in
  one payload.
- `POST /api/auth/login`, `PUT /api/auth/password`
- `PUT /api/settings`
- `POST /api/categories`, `PUT /api/categories/:id` (move/reorder),
  `DELETE /api/categories/:id`
- `POST /api/attributes`, `PUT /api/attributes/:id`,
  `DELETE /api/attributes/:id`
- `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`
