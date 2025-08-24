# CarCruise — Peer‑to‑Peer Car Rental Platform (Node.js, Express, MongoDB)

CarCruise is a full‑stack web app for listing cars, discovering rentals on a map, and managing booking requests end‑to‑end. It includes owner dashboards, user booking history, rich UI with a consistent brand, and privacy/terms pages for production readiness.

## ✨ Highlights

- Authentication and sessions (signup, login, logout) via Passport Local
- Listings CRUD with images (Cloudinary + Multer), tags, search, and Leaflet maps
- Booking requests with validation, status workflows, and re‑booking policy
- Owner Dashboard: booking approvals, income stats, and locked status logic
- My Bookings: filter by status (All/Pending/Approved/Rejected/Completed)
- Consistent brand UI — primary `#fe424d` buttons (`btn-cc`) and outline variant
- Privacy Policy and Terms & Conditions pages
- Robust error handling, flash messages, input validation (Joi)
- Mobile‑first, Bootstrap 5 responsive design

## 🧰 Tech Stack

- Backend: Node.js, Express, EJS, EJS‑Mate
- Database/ORM: MongoDB, Mongoose
- Auth: Passport, passport‑local, passport‑local‑mongoose
- Uploads: Multer, Cloudinary
- UI: Bootstrap 5, Font Awesome
- Maps/Geo: Leaflet, OpenStreetMap Nominatim (geocoding)

## 🗂️ Project Structure

```
CarCruise5/
├── app.js                       # App bootstrap, middleware, routes, errors
├── middleware.js                # Authz/authn & Joi validation middlewares
├── schema.js                    # Joi schemas
├── cloudConfig.js               # Cloudinary storage config
├── controllers/                 # Route controllers (MVC)
│   ├── listings.js              # Listings CRUD + booking handler
│   ├── reviews.js               # Create/Delete reviews
│   ├── users.js                 # Auth + My Bookings + Cancel booking
│   └── deshborad.js             # Dashboard (owner) index + status update
├── models/                      # Mongoose models
│   ├── user.js
│   ├── listing.js               # Includes image + GeoJSON geometry
│   ├── review.js
│   └── booking.js               # Booking: user/owner/listing, dates, status
├── routes/                      # Express routers
│   ├── listing.js               # /listings (CRUD, search, book)
│   ├── review.js                # /listings/:id/reviews
│   ├── user.js                  # /signup, /login, /logout, /my-bookings
│   └── dashboard.js             # /dashboard, POST /dashboard/update-booking-status
├── public/
│   ├── css/
│   │   ├── style.css            # Global styles + brand button classes
│   │   ├── rating.css           # Star rating component
│   │   └── map-styles.css       # Map UI
│   └── js/
│       ├── listing-map.js       # Map logic for new/edit listing
│       ├── show-map.js          # Map logic for show page
│       └── script.js            # General client helpers
├── views/
│   ├── layouts/boilerplate.ejs  # Layout, Bootstrap, Leaflet CSS/JS
│   ├── includes/                # Navbar, footer, flash
│   ├── listings/                # new/edit/show/index
│   ├── users/                   # login/signup/dashboard/my-bookings
│   ├── privacy.ejs              # Privacy Policy page
│   └── terms.ejs                # Terms & Conditions page
├── init/                        # Optional dev seed script
│   ├── data.js
│   └── index.js                 # node init/index.js to seed sample data
├── utils/                       # ExpressError + wrapAsync
├── package.json
└── README.md
```

## 🔑 Authentication & Sessions

- Local auth with `passport-local` and `passport-local-mongoose`
- Flash messages for success/errors, session cookies `httpOnly`
- Middleware exposes `currUser` and flash messages to all views

## 🚗 Listings & Maps

- Create/Edit listings with image upload (Cloudinary) and map location
- GeoJSON `geometry` stored as `Point [lon, lat]`
- If no coordinates submitted, server geocodes with OpenStreetMap Nominatim
- Show page displays a Leaflet map marker with popup

## 🧾 Booking Flow

- Users submit a booking request per listing (name, dates, times, mobile)
- Validation: dates in order, pickup not in past, cannot book own listing
- Re‑booking policy:
  - Block if user has a pending request or an active approved booking
  - Allow rebook if a previous approved booking has completed
  - If previously rejected and no completed approved booking exists, block
- Booking `status`: `pending | approved | rejected`

### Owner Dashboard (/dashboard)

- See your listings and incoming booking requests
- Update booking status (Approved/Rejected)
- Status update is locked once approved and until the booking’s end time
- Income summary calculated from approved bookings (with GST)

### My Bookings (/my-bookings)

- Tabbed filter: All, Pending, Approved, Rejected, Completed
- Derived `completed` status once an approved booking’s end time passes
- Per‑booking cost breakdown (rental days in 0.5‑day increments, GST 18%)
- Cancel action for `pending` bookings

## 🧱 Data Models (overview)

- User: username, email, password (hashed), etc.
- Listing: title, description, price, location, country, image {url, filename}, tags[], geometry
- Review: rating, comment, author (ref User)
- Booking: listing (ref Listing), user (ref User), owner (ref User), dates/times, mobile, status

## 🌐 Routes (selected)

- Listings
  - GET `/listings` — index (supports search/tags via query)
  - GET `/listings/new` — new form (auth)
  - POST `/listings` — create (auth, upload, validate)
  - GET `/listings/:id` — show
  - GET `/listings/:id/edit` — edit (auth + owner)
  - PUT `/listings/:id` — update (auth + owner, upload, validate)
  - DELETE `/listings/:id` — destroy (auth + owner)
  - POST `/listings/:id/book` — create booking request (auth)
  - POST `/listings/search` — search (delegates to index controller)
- Reviews
  - POST `/listings/:id/reviews` — create (auth, validate)
  - DELETE `/listings/:id/reviews/:reviewId` — delete (auth, author)
- Users
  - GET/POST `/signup`, GET/POST `/login`, GET `/logout`
  - GET `/my-bookings` — user’s bookings
  - POST `/bookings/:id/cancel` — cancel pending booking
- Dashboard
  - GET `/dashboard` — owner dashboard
  - POST `/dashboard/update-booking-status` — approve/reject
- Static
  - GET `/privacy`, GET `/terms`

## 🎨 UI & Branding

- Primary brand color: `#fe424d`
- Reusable buttons: `btn-cc` (filled), `btn-cc-outline` (outline)
- Nav pills active state styled to brand color
- Mobile‑responsive layouts with Bootstrap 5

## ⚙️ Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017/carcruise` by default)
- Cloudinary account (for image uploads)

### Install

```bash
npm install
npm run dev   # or: npm start
```

### Environment Variables (.env)

```
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_KEY=your_cloud_key
CLOUDINARY_SECRET=your_cloud_secret
```

### (Optional) Seed Sample Data

```bash
node init/index.js
```

## 🔒 Validation & Error Handling

- Joi schemas in `schema.js` and middleware enforcement
- Centralized `ExpressError` and 404 catch‑all
- Flash messages for user feedback

## 🧪 Manual Test Guide (great for a PPT demo)

1. Sign up and log in
2. Create a new listing (upload image, set location on the map)
3. Log in from another account and submit a booking request
4. Switch to the owner account → Dashboard → Approve the booking
5. Observe “Income” tab and booking lock behavior until end time
6. View “My Bookings”; filter tabs and cost breakdown with GST
7. Browse listings with tags and search; open map on show page
8. Visit Privacy and Terms pages

## 🧹 Maintenance Notes

- Unused legacy map files removed; button styles centralized (`btn-cc`, `btn-cc-outline`)
- Duplicate route handler in `routes/listing.js` removed to prefer controller path
- Seed scripts live under `init/` for local development convenience

## 📄 License

ISC

## 📬 Contact

For questions or support: `support@carcruise.com`
