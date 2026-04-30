# Lattice Open Tournament — Phase 1 Framework

Registration web app for the Lattice Open, hosted by Major Mayhem.

## ⚠️ Read this if you got a Vercel 404

The previous repo had `lattice-tournament.jsx` sitting at the root with no build setup — Vercel didn't know it was a React app, so it served nothing. **This version is a proper Vite project.** Replace the contents of your repo with this folder and Vercel will pick it up automatically.

## Project layout

```
.
├── index.html              ← HTML entry point
├── package.json            ← deps + build scripts
├── vite.config.js          ← Vite (build tool) config
├── tailwind.config.js      ← Tailwind CSS scanning rules
├── postcss.config.js       ← PostCSS pipeline
├── .gitignore
├── README.md
└── src/
    ├── main.jsx            ← mounts <App /> into #root
    ├── App.jsx             ← the registration flow (was lattice-tournament.jsx)
    └── index.css           ← Tailwind directives + body reset
```

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Deploying to Vercel

1. **Replace your repo contents.** Delete the old `lattice-tournament.jsx` and `server.js` from the root of `major_mayhem_marvel_rivals_tournament`. Upload all the files in this folder to the root instead.
2. **Push to `main`.** Vercel watches your `main` branch.
3. **Vercel auto-detects Vite** — no manual config needed. It will run `npm install`, `npm run build`, and serve `/dist`.
4. If your existing Vercel project is already linked to the repo, the next push will trigger a redeploy automatically. If not, "Import Project" in Vercel and point it at the GitHub repo.

That's it. You should see the live site within ~60 seconds of pushing.

## What works in this build

✅ Landing page with 4 tiles (Register / Brackets / Leaderboards / Streamer Hub)
✅ "Coming Soon" placeholders for the three not-yet-built sections
✅ Full 7-step registration with conditional Solo/Partial vs Full Team branch
✅ All TOS gates enforce the checkbox before "Continue" unlocks
✅ Mock PayPal handoff (real PayPal is the next thing to wire up)
✅ Persistent comical "Under Construction" hazard tape, top-right

## What's intentionally not deployed yet

🔌 **`server.js`** (the Express backend) is **not included in this Vercel build.** Vercel's serverless functions don't support flat-file storage, so deploying the Express server as-is would fail. Two options when you're ready:

   - **Option A:** Deploy the backend separately on Railway, Render, or Fly.io (good if you want to keep using Express).
   - **Option B:** Convert each route into a Vercel serverless function under `/api/*.js` and use a real database (Vercel Postgres, Supabase, etc.) instead of the JSON file.

   I can do either when you're ready — just tell me which way you want to go.

🔌 **PayPal:** the "Pay" button currently runs a mock 1.4-second handoff. Wire `@paypal/react-paypal-js` Buttons in `StepPayment` once you have a sandbox client ID.

🔌 **Form submission:** the registration currently completes locally and shows a toast. To send to a backend, hit `fetch()` from the `Registration` component's `onComplete`.

## Removing the "Under Construction" tape

When the app is fully wired and you're ready to launch, remove the `<UnderConstructionTape />` invocation in the root `App` component (and its function definition below).
