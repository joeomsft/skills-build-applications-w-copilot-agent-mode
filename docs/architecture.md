# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Route capability requests through `src/api/client.ts`, then render React data and accessible loading, empty, and error states in the presentation components.
- Logic tier decision: Keep Express routes responsible for HTTP validation and envelopes while services own leaderboard aggregation, activity scoring, and workout recommendation rules.
- Data tier decision: Add required Mongoose fields to `User`, `Team`, `Activity`, and `Workout`; retain stable team member defaults and preserve unrelated seed records.
- Activity tracking approach: Validate activity IDs and references before creation, compute positive points, and store `occurredAt` with the documented activities response envelope.
- Team management approach: Reject teams without a name, default members to an empty array, and preserve submitted names, mascots, and member IDs in create/list responses.
- Leaderboard approach: Aggregate activity points by team, sort totals descending, and assign consecutive 1-based ranks to entries with the expected team and score fields.
- Workout suggestions approach: Match the requested seeded user by email, derive a goal or recent activity focus, and return matching workouts with an explanatory reason.
- Seed approach: Keep seed data idempotent with stable demo upserts, reconcile Mona's previous team membership, and leave sentinel fixtures unchanged across repeated runs.
- Verification decision: Stabilize data contracts first, then API contracts, then presentation contracts, and finish with both builds so each tier exposes a smaller failure surface.

## Test plan

Baseline captured on `build-octofit-app` with MongoDB running:

- Data: `npm run test:data --prefix octofit-tracker/backend` - Seed coverage passed; 4 tests fail because required Mongoose validation is missing from the four models.
- API: `npm run test:api --prefix octofit-tracker/backend` - All 4 tests fail: activities and teams return not-implemented responses, leaderboard is empty, and workout suggestions omit reasons.
- Frontend: `npm test --prefix octofit-tracker/frontend` - All 15 tests are red, covering missing activity/team/leaderboard/workout data and loading, empty, and accessible error states.
- Backend build: `npm run build --prefix octofit-tracker/backend` - Run after API contract tests pass to catch route and service type errors.
- Frontend build: `npm run build --prefix octofit-tracker/frontend` - Run after presentation contract tests pass to catch component and client integration errors.

Implementation order:

1. Run the data contract test and fix only model validation, then rerun it.
2. Run the API contract test and fix service logic/routes, starting with input and reference validation before aggregate and workout behavior.
3. Run the frontend contract test and fix the shared client and four capability components plus their loading and empty/error states.
4. Run each build and the corresponding contract suite again after that layer's implementation is stable.
