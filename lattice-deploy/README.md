# Lattice Open Tournament — Phase 1 Framework

Registration web app for the Lattice Open, hosted by Major Mayhem. Registrations flow live into a Google Sheet via Google Apps Script.

## Project layout

```
.
├── index.html              ← HTML entry point
├── package.json            ← deps + build scripts
├── vite.config.js          ← Vite (build tool) config
├── tailwind.config.js      ← Tailwind CSS scanning rules
├── postcss.config.js       ← PostCSS pipeline
├── Code.gs                 ← Google Apps Script (paste into your sheet)
├── .gitignore
├── README.md
└── src/
    ├── main.jsx                ← mounts <App /> into #root
    ├── App.jsx                 ← the registration flow
    ├── submitRegistration.js   ← POSTs registrations to the sheet
    └── index.css               ← Tailwind directives + body reset
```

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

For local sheet logging during development, create `.env.local` in the project root:
```
VITE_SHEETS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## Setting up the Google Sheet (one-time, ~5 minutes)

1. **Create the sheet.** Go to [sheets.new](https://sheets.new) and name it whatever you want — `Lattice Open · Registrations` is a good choice.
2. **Open the script editor.** From the sheet, click `Extensions → Apps Script`.
3. **Paste the script.** Delete the boilerplate `function myFunction() {}` and paste in the entire contents of `Code.gs` from this project. Save (⌘S / Ctrl+S).
4. **Run `setupSheet` once.** At the top of the Apps Script editor, the function dropdown will show `setupSheet` — select it and click `Run`. Google will ask for permission to access your spreadsheet — grant it. (You'll see a "Google hasn't verified this app" warning because it's your own personal script — click `Advanced → Go to (unsafe)` to proceed. This is expected for personal Apps Script projects.)
5. **Verify headers.** Switch back to the sheet — you should see a `Registrations` tab with a yellow header row.
6. **Deploy as web app.** In the Apps Script editor, click `Deploy → New deployment`. Click the gear icon next to "Select type" and pick **Web app**. Configure:
   - **Description:** `Lattice Open Registrations v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (this is required for the form to reach it — the URL is unguessable)
   - Click `Deploy`. Authorize again if prompted.
7. **Copy the Web app URL.** It looks like `https://script.google.com/macros/s/AKfycb.../exec`. Save this — you need it in the next step.

## Wiring the URL into Vercel

1. Go to your Vercel project → `Settings → Environment Variables`.
2. Add:
   - **Name:** `VITE_SHEETS_URL`
   - **Value:** the Web app URL you just copied
   - **Environments:** check Production, Preview, and Development
3. Save, then go to `Deployments`, find the latest deployment, click the `⋯` menu → `Redeploy`. The env var is baked into the build, so a redeploy is required to pick it up.

That's it. The next time someone completes the registration form, a row appears in your sheet within ~2 seconds.

## Updating the Apps Script later

If you need to edit `Code.gs` (add columns, change validation, whatever), you must redeploy:
- Apps Script editor → `Deploy → Manage deployments`
- Click the pencil icon on your existing deployment
- Change `Version` to `New version`
- Click `Deploy`

The URL stays the same, so no Vercel changes needed.

## Deploying frontend changes to Vercel

Vercel auto-detects Vite. Push to `main`, it builds and deploys. Two case-sensitivity gotchas to remember:
- `src/App.jsx` must be **capital A** — Linux is case-sensitive
- `index.html` must be at the root of the repo

## What works in this build

✅ Landing page with 4 tiles (Register / Brackets / Leaderboards / Streamer Hub)
✅ "Coming Soon" placeholders for the three not-yet-built sections
✅ Full 7-step registration with conditional Solo/Partial vs Full Team branch
✅ All TOS gates enforce the checkbox before "Continue" unlocks
✅ Registrations write to Google Sheets the moment the user "pays"
✅ Persistent comical "Under Construction" hazard tape, top-right

## What's intentionally not deployed yet

🔌 **Real PayPal:** the "Pay" button currently runs a mock 1.4-second handoff, then logs to the sheet with `payment_status: "paid_mock"`. Wire `@paypal/react-paypal-js` Buttons in `StepPayment` once you have a sandbox client ID. When you do, change the `paymentStatus` value passed to `submitRegistration` from `"paid_mock"` to `"paid"`.

🔌 **Brackets / Leaderboards / Streamer Hub:** all three landing tiles route to a "Coming Soon" placeholder. Build out one at a time.

🔌 **Discord notifications:** when a registration comes in, you might want a webhook ping in your mod channel. Easy add in `Code.gs` — let me know when you want it.

## Removing the "Under Construction" tape

When the app is fully wired and you're ready to launch, remove the `<UnderConstructionTape />` invocation in the root `App` component (and its function definition below).
