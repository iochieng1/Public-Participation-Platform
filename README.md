# Public Participation Platform (Kenya)

Citizens rarely get a real say in local decisions. This platform gives every Kenyan a way to comment on county
and national bills, Finance Bills, budgets and development plans, from **any phone** (web, SMS or USSD) and in
**Kiswahili or English**. It also makes sure each person **hears back** how their view was considered.

**Case study and design:** [docs/KENYA_CASE_STUDY.md](docs/KENYA_CASE_STUDY.md) (constitutional and statutory
basis, design principles, architecture, the Kisumu pilot, risks). **Pilot county:** Kisumu (042). All 47 counties
are seeded, and Kisumu's 7 sub-counties and 35 wards are loaded.

## What it does

| Flow | Web | SMS | USSD |
|---|---|---|---|
| Comment on an open consultation (support / oppose / amend / general) | ✓ | `KSMFB24 HAPANA <comment>` | menu 1 |
| Report a ward issue (water, roads, health…) and upvote others | ✓ | | menu 2 |
| Track a submission or issue reference | ✓ | `STATUS S-ABC234` / `HALI …` | menu 3 |
| Set home ward, switch language | ✓ | | menu 4, 5 |

County officers use the web app to:
- Draft consultations. Publishing is blocked without a Kiswahili summary, the full document and a minimum window.
- Digitise paper memoranda and baraza/town-hall comments.
- Record a decision and reason for every submission.
- Publish a public **feedback report**, which sends every participant an SMS with their outcome.
- Respond to ward issues. The reporter gets each update by SMS.

## Stack

`apps/api`: Node 18+, Express, Zod, Prisma, PostgreSQL. `apps/web`: React + Vite. SMS and USSD go through
[Africa's Talking](https://africastalking.com).

## Running locally

```bash
npm install
npm run db:up                                  # PostgreSQL on localhost:5433 (docker compose)
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w apps/api                 # apply migrations
npm run db:seed -w apps/api                    # counties, Kisumu wards, demo users, demo Finance Bill
npm run dev:api                                # http://localhost:4000
npm run dev:web                                # http://localhost:5173
```

## Signing in (for reviewers)

Citizens sign in with a phone number and a 6-digit code sent by SMS. **You don't need a phone or an SMS
account to review the app.**

With the default `SMS_PROVIDER=console` the app runs in **demo mode**:

1. Open http://localhost:5173/signin.
2. Under **"Reviewing the demo?"**, click one of the accounts below, or type any Kenyan mobile number and click
   **Send code**.
3. The code appears on screen and is filled in for you. Click **Verify**.

| Demo account | Phone | What you can do |
|---|---|---|
| Kisumu county officer | 0700 000 042 | Draft/publish Kisumu consultations, record paper and forum submissions, decide on submissions, publish the feedback report, respond to Kisumu ward issues |
| National admin | 0700 000 001 | Everything above, for national consultations and any county |
| Citizen | any other number, e.g. 0712 345 678 | Set your ward, comment on the Finance Bill, report and upvote ward issues, track references |

Every "SMS" (codes, receipts, outcome notices) is also printed in the API terminal as `[sms -> +2547…] …`.

**How demo mode is kept out of production**

- Demo mode is on only when `SMS_PROVIDER=console`. Set `DEMO_MODE=false` to hide codes from the browser even
  then; they will still be printed in the API terminal.
- The API **refuses to start** with `NODE_ENV=production` and `SMS_PROVIDER=console`, so a real deployment must
  configure Africa's Talking, and codes then only ever travel by SMS.
- Codes are single-use, expire after 5 minutes, allow 5 attempts, and are limited to 3 requests per number per
  15 minutes.

**Testing real SMS and USSD without a handset:** create a free [Africa's Talking sandbox](https://account.africastalking.com)
app, set `SMS_PROVIDER=africastalking`, `AT_USERNAME=sandbox` and the sandbox `AT_API_KEY`, then use the
sandbox phone simulator. It receives the SMS codes and can dial your USSD code once the callback URLs below
point at the API (for a local API, expose it with a tunnel such as ngrok).

## Try SMS and USSD without a phone

The USSD menu and SMS keywords can be exercised with curl, as Africa's Talking would call them:

```bash
curl -X POST "localhost:4000/api/callbacks/ussd?token=change-me" -d phoneNumber=0711222333 -d text=      # main menu
curl -X POST "localhost:4000/api/callbacks/ussd?token=change-me" -d phoneNumber=0711222333 -d 'text=4*42*1*1'  # set ward
curl -X POST "localhost:4000/api/callbacks/sms?token=change-me" -d from=0711222333 -d 'text=KSMFB24 NO too expensive'
```

To connect Africa's Talking, set `SMS_PROVIDER=africastalking`, `AT_USERNAME`, `AT_API_KEY` and optionally
`AT_SENDER_ID`. Point the USSD and SMS callback URLs at `/api/callbacks/ussd?token=…` and
`/api/callbacks/sms?token=…`.

## Tests

```bash
npm test     # integration tests against the ppp_test database (created/reset automatically)
```

Set `TEST_DATABASE_URL` to use a different database.

## Licence

MIT
