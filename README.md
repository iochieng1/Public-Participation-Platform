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

With `SMS_PROVIDER=console` every SMS, including sign-in codes, is printed in the API terminal.
Seeded accounts (sign in with the code from the console):

| Phone | Role |
|---|---|
| 0700 000 001 | National admin |
| 0700 000 042 | Kisumu county officer |

Try the USSD menu without a phone:

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
