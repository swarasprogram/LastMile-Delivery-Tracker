# Trace — Last-Mile Delivery Tracker

Full-stack delivery management platform with zone-based pricing, real-time GPS
tracking, road-following ETAs, intelligent agent assignment, Proof of Delivery,
and Stripe payments with automatic refunds on failed deliveries.

- **Frontend:** React + Vite + Tailwind (`frontend/`) — pure-black "Trace" theme.
- **Backend:** FastAPI + SQLAlchemy (async) + PostgreSQL/PostGIS (`backend/`).

## Setup

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt          # now includes stripe
cp .env.example .env                      # then fill in the values (see below)
alembic upgrade head                      # applies schema incl. payment + POD columns
uvicorn app.main:app --reload             # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

## Environment (`backend/.env`)
See `backend/.env.example`. Key settings:

- `DATABASE_URL` — PostgreSQL (PostGIS extension enabled).
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — **test-mode** keys from
  <https://dashboard.stripe.com/test/apikeys>. Prepaid checkout uses Stripe
  Checkout; test card `4242 4242 4242 4242`, any future expiry, any CVC.
- `FRONTEND_URL` — must match where the frontend runs (Stripe redirects the
  customer back here after payment, e.g. `http://localhost:5173`).
- `BREVO_API_KEY` — optional, for failure-notification emails.

## Feature notes

- **Payments (Stripe test mode).** Prepaid orders open a Stripe Checkout session
  and return to the tracking page, which confirms the payment. `Order.payment_status`
  moves `unpaid → paid`.
- **Refund on failed delivery.** When an agent marks a prepaid, paid order
  `failed`, the charge is refunded via the Stripe Refund API and `payment_status`
  becomes `refunded` (logged in the immutable tracking history).
- **Auto-assignment.** `find_best_agent` scores every available agent by
  proximity (live GPS when present, neutral otherwise), current workload, and
  success rate — so orders spread across the whole fleet, not just agents who
  happen to be sharing location. Admins can also manually assign / reassign.
- **Road routing + ETA.** The map draws the real driving route via the public
  OSRM API and shows distance + minute-level ETA to the doorstep.
- **Proof of Delivery.** Agents capture a photo and/or signature on delivery;
  customers see the POD on the tracking page.
- **Admin console.** Manage zones & areas, B2B/B2C rate cards, agents, and an
  agent leaderboard, in addition to orders and the live map.

> Note: pickup + drop addresses and zone detection are retained per the project
> spec; the UI is framed as last-mile ("Pickup / Hub" → "Delivery doorstep").
