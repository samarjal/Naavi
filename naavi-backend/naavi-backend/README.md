# Naavi – AI Travel Planner (backend)

Spring Boot 3.3 · Java 21 · Spring Security + JWT · Spring Data JPA · MySQL · Groq (OpenAI-compatible API)

## Quick start

```bash
# 1. MySQL
docker compose up -d

# 2. Secrets (never commit .env)
cp .env.example .env        # then edit: GROQ_API_KEY and JWT_SECRET (>= 32 chars)
#   generate a JWT secret:  openssl rand -base64 48

# 3. Run
mvn spring-boot:run          # http://localhost:8080
```

`.env` is picked up automatically (`spring.config.import`), or just export the variables in your shell/IDE.
Without `GROQ_API_KEY` or `JWT_SECRET` the app refuses to start, on purpose.

## How a chat turn works (`POST /api/travel/plan`)

```
JWT auth -> load trip (owner-checked) + saved preferences
 -> LLM #1  extract: intent, source, destination, budget, travellers, days, dates, trip-only overrides
 -> merge into Trip / TripPreferenceOverride          (override > saved preference > system default)
 -> anything essential missing? reply type=QUESTION   (source, destination, budget, travellers)
 -> Open-Meteo weather (live)  +  TravelDataProvider (pluggable; none live yet -> prices ESTIMATED)
 -> build AI context JSON  (tripRequest, preferences + sources, tripOverrides, weather, travelData...)
 -> LLM #2  primary itinerary as JSON (unit costs x quantities, no totals)
      backend validates schedule, computes every amount/total/buffer (BudgetEngine)
      invalid or over budget -> ONE automatic regeneration with feedback
 -> LLM #3  Comfort (~1.2x) and Premium (~1.5x) alternatives, costed by the backend, flagged withinTarget
 -> save Itinerary (versioned) + Expense rows; reply type=ITINERARY
```

Follow-ups ("make the hotel cheaper", "add another day", "reduce the budget to 20000", "use cabs") go through the same
endpoint (or `/api/travel/plan/{tripId}/modify`, `/api/trips/{tripId}/chat`). The previous itinerary is passed to the model
as context, the whole plan is regenerated and re-costed, and a new version is stored. Pure questions about the plan
("what's the weather on day 2?") are answered without regenerating.

Response `type`: `QUESTION` (needs more info, see `missingFields`), `ITINERARY` (plan in `itinerary`), `MESSAGE` (plain reply).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` · `/login` | returns `{token, user{onboardingCompleted}}` |
| POST | `/api/auth/logout` | revokes the token server-side (in-memory list) |
| GET/PUT | `/api/users/me` | name, phone, profilePictureUrl |
| GET/POST/PUT | `/api/users/me/preferences` | POST = onboarding (5 core fields required, sets `onboardingCompleted`), PUT = partial edit |
| POST/GET | `/api/trips` | create trip from form fields / list |
| GET/PUT/DELETE | `/api/trips/{id}` | GET includes latest itinerary JSON |
| POST | `/api/travel/plan` | `{message, tripId?}` – no `tripId` starts a new trip |
| POST | `/api/travel/plan/{id}/modify` | `{message}` |
| POST/GET | `/api/trips/{id}/chat` | send a message / read history |

Preference enums – food: `VEGETARIAN NON_VEGETARIAN VEGAN JAIN NO_PREFERENCE OTHER`; local travel: `PUBLIC_TRANSPORT AUTO_RICKSHAW CAB_TAXI RENTAL_BIKE RENTAL_CAR WALKING NO_PREFERENCE`;
accommodation: `HOSTEL BUDGET MID_RANGE PREMIUM RESORT HOMESTAY NO_PREFERENCE`; style: `BUDGET BACKPACKING RELAXED ADVENTURE FAMILY COUPLE LUXURY CULTURAL NATURE RELIGIOUS`;
transport: `CHEAPEST FASTEST COMFORTABLE TRAIN_PREFERRED BUS_PREFERRED FLIGHT_PREFERRED NO_PREFERENCE`.

### Smoke test

```bash
BASE=http://localhost:8080
TOKEN=$(curl -s $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Asha","email":"asha@example.com","password":"password123"}' | jq -r .token)

curl -s -X POST $BASE/api/users/me/preferences -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"foodPreference":"VEGETARIAN","localTravelPreference":"PUBLIC_TRANSPORT","accommodationPreference":"BUDGET",
       "travelStyle":"RELAXED","transportationPreference":"CHEAPEST"}'

curl -s -X POST $BASE/api/travel/plan -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"I want to visit Goa in ₹30,000"}' | jq .reply        # asks for source + travellers

curl -s -X POST $BASE/api/travel/plan -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"tripId":1,"message":"From Delhi, 2 people, 5 days"}' | jq .
```

## Result JSON (`itinerary`)

`tripSummary`, `weather{mode,location,note,days[]}`, `transportation[]`, `accommodation[]`, `days[]{date, weather, activities[]}`,
`expenses{items[], byCategory, total, budget, remaining, overBy, withinBudget, buffer, budgetWarning?, possibleReductions?}`,
`alternatives[]{planType, upgrades, dayChanges, expenses{..., targetAmount, withinTarget}}`, `packingChecklist`,
`preferencesUsed{values, sources}`, `assumptions`, `validationWarnings`, `dataNotice`.
Every priced line carries `dataType`: `LIVE` | `ESTIMATED` | `USER_PROVIDED`.

## Design notes

- **LLM never does arithmetic.** It supplies `unitCost` × `quantity`; `BudgetEngine` computes amounts, totals, remaining, overrun and the 5–10 % buffer status.
- **`LIVE` is never trusted from the model.** Only weather is live. Plug hotels/transport/places into `TravelDataProvider`
  (see `NoLiveTravelDataProvider`); until then every price is labelled `ESTIMATED`.
- **Isolation.** Every trip lookup is `findByIdAndUserId`; other users' trips return 404. Chat, itinerary and expense rows are reachable only through an owned trip.
- **No DB transaction is held during LLM calls.** A per-trip in-flight guard returns 409 for concurrent requests on the same trip.
- JWT filter is created inside `SecurityConfig` (not a `@Component`) to avoid double registration.

## Known limitations / next steps

- **Not compiled or run in the environment this was written in** (no Maven/network there). Run `mvn test` and the smoke test above first; expect to fix small things.
- Schema is created by Hibernate `ddl-auto=update`; move to Flyway + `validate` before production.
- Token revocation list is in memory (single instance). Use Redis/DB if you scale out.
- No per-user rate limiting on AI endpoints yet; each plan costs 2–3 Groq calls. Groq free-tier token limits can return 429s (the client retries with backoff, then returns 502).
- Itinerary days/hotels/transport are stored inside the itinerary JSON, not as separate tables (Expense rows are separate). Split them out if you need to query them.
- Weather forecasts reach ~16 days ahead; later dates fall back to the next 3 days with an explanatory note.
- LLM output is untrusted: it is parsed leniently, validated, and only ever rendered as data, but add content filtering if the app goes public.
