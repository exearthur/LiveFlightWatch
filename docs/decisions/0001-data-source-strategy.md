# 0001: Data-source strategy

- **Status:** accepted; takes effect when the owner completes the steps under "What the owner has to do"
- **Date:** 2026-11-13. Every price and quota below was read from the provider's own page on this date.
- **Ticket:** #8 (LFW-1)

## Decision

Add **AeroDataBox** (through the RapidAPI gateway) as a second `FlightProvider`, selected with `FLIGHT_PROVIDER=aerodatabox`. AviationStack stays the default, so merging changes nothing on the live site. The cache TTL stays at 300 seconds.

The month assumed below needs about 1,035 upstream calls. AviationStack's free plan allows 100, and its cheapest paid plan costs $49.99 a month. AeroDataBox's free plan allows 200, and its Pro plan allows 2,500 for $8 a month. No free plan that can supply the board covers the assumed month, so the choice is between paid plans, and AeroDataBox Pro costs a sixth of AviationStack Basic.

## What the app needs

Per airport, a departures and an arrivals board (flight number, airline, origin or destination, scheduled, estimated and actual times, status, terminal, gate), plus a lookup by flight number. A provider without a scheduled board is not a substitute.

## Traffic assumption

This is a guess for a portfolio demo. Vercel Web Analytics is already installed, so replace it with real figures when they exist.

- 10 visits a day, 300 a month. A visit lasts about 5 minutes and opens 2 boards (an airport and direction pair). 1 visit in 4 also looks up a flight number.
- Visitors never share a cached board, because they arrive at different times and look at different airports. This is the worst case for the cache.
- In addition, somebody keeps one board open for an hour a day (the owner demoing it, a tab left visible).

The frontend polls every 45 seconds, but only the first request after the TTL expires reaches the provider. A visit shorter than the TTL costs one call per board whatever the TTL is. A board held open costs `3600 / TTL` calls an hour.

```
calls per month = 300 visits x (2 boards + 0.25 lookups) + 30 hours x (3600 / TTL)
TTL 300 s:  675 + 360 = 1,035      TTL 600 s:  675 + 180 = 855      TTL 900 s:  675 + 120 = 795
```

## Options

"Assumed month" is the cost of those 1,035 calls at the 300 second TTL.

| Option | Price per month | Monthly quota | Assumed month | Board fields | Freshness |
|---|---|---|---|---|---|
| AviationStack Free (today) | $0 | 100 calls | Exhausted on day 3 | All | "delayed by as little as 30-60 seconds" |
| AviationStack Basic | $49.99 | 10,000 calls | Fits, 10% used | All | Same |
| AeroDataBox Basic (RapidAPI) | $0 | 400 units = 200 calls | Exhausted on day 6 | All in the schema; live ones depend on the airport | Live data "typically from nearly real-time up to once in a few hours" |
| **AeroDataBox Pro (RapidAPI)** | **$8** | **5,000 units = 2,500 calls** | **Fits, 41% used** | Same | Same |
| FlightAware AeroAPI Personal | $0.005 per result set of 15 rows; first $5 free | 1,000 result sets free | $0.18 with 15-row boards, $14.58 with 60-row boards | Not confirmed (the API reference did not load) | Not checked |
| OpenSky Network | $0 | 4,000 credits a day | Cannot supply the board | None scheduled: returns flights "which departed within a given time interval" | Arrivals "from the previous day or earlier" |

How the numbers were derived:

- **AviationStack Free.** One viewer holding one board open makes 12 calls an hour, so 100 calls last 8.3 hours. At the assumed 34.5 calls a day they last 2.9 days. A longer TTL does not rescue this plan: 675 of the 1,035 calls are first loads, which no TTL removes, and 100 calls a month is 3 first loads a day.
- **AeroDataBox.** The board and flight-status endpoints are both marked "TIER 2", and a Tier 2 call costs 2 units, so the assumed month is 2,070 units. Basic's 400 units cover about 2 visits a day plus 5 hours of open-board viewing a month (135 + 60 calls). Pro's 5,000 units cover the assumed open-board viewing plus up to 951 visits a month. API.Market sells the same Pro plan for $7.50. The adapter targets RapidAPI because its free plan is "Free forever" (API.Market's is a 7-day trial), so the owner can test before paying.
- **FlightAware.** 1,035 single-page queries cost $5.18. Four pages per board is 3,915 result sets, or $19.58. Rejected because the Personal tier is licensed "for personal or academic purposes only", use beyond the free $5 is billed per query with no spending cap mentioned, and this backend is a public endpoint anyone can call. AeroDataBox rejects calls once the quota is spent instead of billing for them.
- **Also checked.** AirLabs marks only flight number, airline code, airports and scheduled times as available in its Free plan (no status, terminal, gate or estimate), capped at 50 rows. Its quota and prices could not be read because the pricing section did not render. Aviation Edge costs $7 for the first month, then $299 a month for 30,000 calls.

## What gets worse

- **Freshness and coverage.** Estimated and actual times and status come from AeroDataBox's live layer, which does not cover every airport. Its country table (updated 2026-06-03) puts schedule and live coverage at 100% and 86% for the United States, 99% and 71% for the United Kingdom, 98% and 93% for Germany. It rates terminal and gate as present "sometimes", and says a schedule-only flight keeps the status "Unknown". Some boards will show scheduled times only, with status `unknown`.
- **The queried airport's name** is not in AeroDataBox board rows, so `origin.name` (departures) or `destination.name` (arrivals) is null. The IATA code is still set.
- **Board shape.** The adapter asks for a 12-hour window (the most Basic and Pro allow in one call) with codeshare duplicates left out. Boards therefore have one row per aircraft, and a large hub's board is probably several hundred rows long. That row count is an estimate.
- **A board left open around the clock** costs 288 calls a day at 300 seconds and would spend Pro's quota in 8.7 days. That is outside the assumption. If it happens, raise `CACHE_TTL_SECONDS`: at 900 seconds the same board costs 96 calls a day.

## Not confirmed

- **The adapter has never called the live API.** It was written from the published OpenAPI description (v1.15.4.0) and tested against mocked responses.
- **The quota-exceeded status code.** Neither AeroDataBox's spec nor the RapidAPI pages read state it. The adapter treats HTTP 429 as the rate limit. If RapidAPI answers differently, visitors see a generic error instead of the "quota reached" state.
- **The timestamp format.** The spec says only `date-time`. The adapter accepts ISO 8601 with a "T" or a space.
- **Whether RapidAPI wants a card for the free plan.** Its docs say freemium APIs "require a credit card, even for the free plan".
- **That a month fits the quota.** This is arithmetic on an assumed traffic level. Nothing was measured on the live site.

## What the owner has to do

1. Create a RapidAPI account and subscribe to AeroDataBox at https://rapid.aerodatabox.com/pricing. Basic (free) is enough to test, and for about 2 visits a day. Pro ($8 a month) is the plan the assumed month needs.
2. On the Render service, add `AERODATABOX_API_KEY` with the `X-RapidAPI-Key` value. The app refuses to start if the selected provider's key is missing.
3. Set `FLIGHT_PROVIDER` to `aerodatabox`. Change the value in `render.yaml` if the service is synced from the Blueprint, otherwise change it in the Render dashboard.
4. On the deployed backend, request `/api/flights?airport=JFK&type=departures`, the same with `type=arrivals`, and `/api/flights/lookup?flight_number=` with a flight from that board. Compare the board with the airport's own. This is the adapter's first contact with the live API.
5. Update `frontend/src/pages/About.tsx`, which credits AviationStack. AeroDataBox requires attribution on its free plan.
6. Watch usage on the RapidAPI dashboard for the first month and compare it with the formula above.

To roll back, set `FLIGHT_PROVIDER` to `aviationstack` again.

## Sources (all read 2026-11-13)

- AviationStack plans, prices and quotas: https://aviationstack.com/pricing
- AviationStack freshness: https://aviationstack.com/faq
- AeroDataBox plans, units per tier, behaviour when the quota is spent, attribution: https://aerodatabox.com/pricing/
- AeroDataBox endpoints, tiers and response schema: https://doc.aerodatabox.com/docs/openapi-rapidapi-v1.json
- AeroDataBox coverage and update intervals: https://www.aerodatabox.com/data-coverage
- RapidAPI card requirement: https://docs.rapidapi.com/docs/api-pricing
- FlightAware AeroAPI tiers, per-query prices and licence wording: https://www.flightaware.com/commercial/aeroapi/
- OpenSky credits and endpoint notes: https://openskynetwork.github.io/opensky-api/rest.html
- AirLabs Free plan fields: https://airlabs.co/docs/schedules
- Aviation Edge prices: https://aviation-edge.com/premium-api/
