# Tripwise: trip expense tracker (PWA)

An installable phone app that tracks what you spend on a trip. Expenses get in three ways:

1. **Automatically from bank SMS.** Your Android phone forwards each bank "debited" SMS to this app's private inbox (`/api/ingest`). The app reads it and adds the expense with a category, including payments you make directly in GPay, PhonePe or Paytm.
2. **Pay with UPI from inside the app.** Scan a merchant's QR code or type a UPI ID. Your UPI app opens with the payee and amount filled in, and the payment is logged when you come back.
3. **By hand, or by pasting or sharing bank SMS.** Use this for cash or card payments.

Smart features: it guesses the category (Food, Transport, Stay, Fuel and so on) and learns from your corrections. It shows how much is "safe to spend today", whether you're on pace for your budget, daily and category charts, and insights. It skips duplicate payments (by UPI reference), ignores OTP and failed-payment SMS, works offline and exports to CSV.

## So nothing gets missed

- **Credits and debits** are both recorded. Spending counts toward your budget. Money received (refunds, friends paying you back) shows in green as **+₹** and can optionally be subtracted from the total (Settings).
- **Needs review.** Any forwarded SMS that mentions money but can't be read automatically appears on the Home screen for you to add or dismiss. Nothing is dropped silently. OTPs, promos and failed or declined payments are ignored.
- **UPI Lite** payments send no bank SMS, so turn UPI Lite off for the trip. Lite top-ups go to review instead of being counted as spending.
- Set SMS Forwarder's battery setting to **Unrestricted**. The Home screen shows "last SMS received" so you can see forwarding is working.

## Deploy (Vercel, free)

1. Import this repo in Vercel. The framework is detected as **Vite**, so keep the defaults.
2. **Storage → Upstash for Redis → Create** (free tier) and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Settings → Environment Variables**: add `INGEST_KEY` = any long random secret.
4. Redeploy. Open the URL in Chrome on your phone, then **⋮ → Install app**.

## Turn on auto-capture (Android / Pixel)

1. In the app: **Settings → Secret key** → enter your `INGEST_KEY` → **Connect**.
2. Install **SMS Forwarder** (bogkonstantin, Play Store / F-Droid, open source).
3. Add a forwarding rule. Use sender `*` (or your bank's sender ID). Set the webhook URL to the one shown in the app's Settings:
   `https://YOUR-APP.vercel.app/api/ingest?key=YOUR_INGEST_KEY`
   Keep the default JSON template (`{"from":"%from%","text":"%text%",...}`).
4. Done. Each payment SMS becomes an expense the next time you open the app.

The webhook accepts JSON `{ "text": "..." }`, plain text or form data, so Tasker, MacroDroid or an iOS Shortcut also work.

## Privacy

Expenses are stored only in your phone's browser storage. The server inbox holds the last 500 forwarded SMS in your own Upstash database, protected by your secret key. UPI PINs are only ever entered in your UPI app.

## Develop

```
npm install
npm run dev     # UI only; /api needs `vercel dev`
npm run build
```
