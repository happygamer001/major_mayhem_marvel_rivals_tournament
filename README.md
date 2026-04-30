# Lattice Open Tournament — Phase 1 Framework

A starting framework for the Lattice Open registration web app, hosted by Major Mayhem.

## What's in here

| File | What it is |
| --- | --- |
| `lattice-tournament.jsx` | React frontend — landing page + 7-step registration flow |
| `server.js` | Node/Express backend skeleton — registration endpoint + PayPal stubs |

## What works right now

✅ Landing page with 4 tiles (Register, Brackets, Leaderboards, Streamer Hub)
✅ Brackets / Leaderboards / Streamer Hub show a "Coming Soon" placeholder
✅ Multi-step registration form with:
   - Basic info (Name, Discord, IGN, Rank, Servers)
   - Discord TOS gate
   - Tournament TOS gate
   - Team type selector (Solo / Partial / Full)
   - **Conditional branch:**
     - Solo / Partial → RPMA TOS agreement (no team name input)
     - Full Team → Captain confirmation + responsibility acknowledgment + team name (with reviewer notice)
   - Broadcasting TOS gate
   - Payment screen (PayPal placeholder — currently mocked)
✅ Persistent comical "Under Construction" hazard-tape sticker, top-right
✅ Full validation per step — Continue button stays disabled until requirements met
✅ Backend `/api/register` validates payload server-side too (don't trust the client)

## What's stubbed for you to wire up later

🔌 **PayPal:** the "Pay" button currently runs a 1.4-second fake handoff. Replace `handlePay` in the `StepPayment` component with a call to `/api/paypal/create` followed by either a redirect or the official `@paypal/react-paypal-js` Buttons component.

🔌 **Form submission:** the React app currently completes locally and shows a toast. To send to the backend, in the `Registration` component's `onComplete`, do:
```js
fetch("http://localhost:4000/api/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
}).then(r => r.json()).then(console.log);
```

🔌 **Other 3 landing tiles:** Brackets, Leaderboards, Streamer Hub all hit `<ComingSoon />`. Build those out as you go.

🔌 **Backend storage:** currently flat-file JSON at `./data/registrations.json`. Swap for Postgres or Mongo before public launch.

🔌 **Admin auth:** `GET /api/registrations` is wide open. Add an auth middleware before deploying.

## Setup

### Frontend (Vite + React example)
```bash
npm create vite@latest lattice-frontend -- --template react
cd lattice-frontend
npm install lucide-react
# drop lattice-tournament.jsx into src/, import it from App.jsx
npm run dev
```

### Backend
```bash
mkdir lattice-backend && cd lattice-backend
npm init -y
npm install express cors dotenv
# drop in server.js
node server.js
```

The backend listens on `:4000` and expects the frontend on `:5173` (Vite default). Override with `CLIENT_ORIGIN` env var.

## TOS sources

The TOS bullet summaries shown in-app are paraphrased from the four PDFs in the project:
- `2026_Marvel_Rivals__Discord_TOS.pdf`
- `2026_Marvel_Rivals__TOS_Casual.pdf`
- `2026_Marvel_Rivals__Random_Player_Matchmaking_Agreement.pdf`
- `2026_Marvel_Rivals__Broadcasting_TOS.pdf`

The summaries are for screen readability — the full PDFs remain the authoritative legal documents. Before launch, link the actual PDFs from each TOS step (host them on the Shopify side or a CDN).

## Removing the "Under Construction" tape

Once the app is fully functional, delete the `<UnderConstructionTape />` component invocation in the root `App` component, plus the component definition itself.
