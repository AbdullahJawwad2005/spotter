<div align="center">
  <img src="public/SpotterLogo.png" alt="Spotter" width="80" height="80" />
  <h1>Spotter</h1>
  <p><strong>Your AI-powered personal trainer — live form coaching, adaptive workout planning, and nutrition guidance, all in the browser.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/Claude-AI-D97706?style=flat-square" />
    <img src="https://img.shields.io/badge/MediaPipe-Pose-FF6F00?style=flat-square" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  </p>

  <p>
    <a href="https://github.com/AbdullahJawwad2005/spotter/issues">Report Bug</a> ·
    <a href="https://github.com/AbdullahJawwad2005/spotter/issues">Request Feature</a>
  </p>
</div>

---

## The Problem

Most people who lift have no idea if their form is correct. Personal trainers are expensive. Gym mirrors only show you so much. Bad technique leads to injury — and most form errors are invisible to the untrained eye until something goes wrong.

## What Spotter Does

Spotter is a full-stack AI fitness coach that runs entirely in the browser. Point your camera at yourself during a squat, and Spotter analyzes every rep in real time — tracking knee angle, back lean, depth, and asymmetry — then speaks personalized cues aloud before you even finish the set. No uploads. No subscription. No gym required.

Beyond form coaching, Spotter generates personalized workout plans via Claude, tracks your sessions, manages your schedule, and gives AI-driven nutrition guidance.

---

## Features

### Live Form Coaching
- **Real-time pose estimation** via MediaPipe Pose (WASM, fully on-device — video never leaves your machine)
- **Per-rep scoring** 0–100 with detailed breakdown: depth, back lean, asymmetry, and tempo
- **Voice coaching** via Web Speech API — cues spoken aloud mid-set, rest announcements, and debrief after each set
- **Skeleton overlay** on live video with risk-score color coding
- **Phase detection** — standing → descending → bottom → ascending state machine
- **Injury risk accumulation** — stops you before you push through dangerous reps

### AI Workout Builder
- Generate a fully structured workout in 15 seconds
- Customize: goal (strength / muscle / fat loss / fitness), experience level, focus area, equipment, and duration
- Claude generates sets, reps, rest periods, and coaching notes for each exercise
- Plans saved to your account and available for future sessions

### Workout Sessions
- Live progress sidebar with per-exercise set tracking
- Rest timer with countdown and skip option
- Coach debrief after each set: form score trend, top cue, comparison to previous sets
- Tap-based rep counter for non-scored exercises
- Auto-finish when target reps are reached (form-scored exercises)
- Session state persisted in localStorage — resume mid-workout after a refresh

### Schedule & Tracking
- Weekly calendar view with drag-friendly scheduling
- Workout completion streaks and weekly stats
- Workout log stored in Supabase — history always available

### Nutrition
- AI-powered nutrition guidance via Claude
- Contextual to your current training goals

### Quality of Life
- Light / dark mode toggle (default: pitch black)
- Fully responsive — desktop and mobile
- Auth with Supabase (email + password)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│                                                              │
│  React 18 + TypeScript + Vite                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  MediaPipe   │  │  Web Speech  │  │   shadcn/ui +    │  │
│  │  Pose (WASM) │  │  API (voice) │  │   TailwindCSS    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                                      │             │
│  ┌──────▼──────────────────────────────────────▼──────────┐ │
│  │              Squat Engine (state machine)               │ │
│  │  Phase detection · Rep scoring · Risk accumulation      │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ supabase-js
┌────────────────────────▼────────────────────────────────────┐
│                      Supabase                                │
│                                                              │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Postgres   │  │         Edge Functions (Deno)         │  │
│  │             │  │                                       │  │
│  │  profiles   │  │  generate-workout   → Claude API      │  │
│  │  workout_   │  │  generate-weekly-   → Claude API      │  │
│  │    plans    │  │    plan                               │  │
│  │  scheduled_ │  │  fitness-chat       → Claude API      │  │
│  │   workouts  │  │  coach              → Claude API      │  │
│  │  workout_   │  │  nutrition          → Claude API      │  │
│  │    logs     │  │                                       │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
│                                                              │
│  Auth (email + password)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | TailwindCSS + shadcn/ui + Radix UI |
| Routing | react-router-dom v6 |
| Backend / Auth / DB | Supabase (Postgres + Edge Functions) |
| AI | Anthropic Claude (via Supabase Edge Functions) |
| Pose estimation | MediaPipe Pose (WASM, on-device) |
| Voice | Web Speech API |
| State management | React hooks + TanStack Query |
| Forms | React Hook Form + Zod |

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)

### 1. Clone the repo

```bash
git clone https://github.com/AbdullahJawwad2005/spotter.git
cd spotter
```

### 2. Install dependencies

```bash
npm install
# or
bun install
```

### 3. Configure environment

Create a `.env.local` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up Supabase

Run the migrations in `supabase/migrations/` against your Supabase project, or use the Supabase CLI:

```bash
supabase db push
```

Deploy the edge functions:

```bash
supabase functions deploy generate-workout
supabase functions deploy generate-weekly-plan
supabase functions deploy fitness-chat
supabase functions deploy coach
supabase functions deploy nutrition
```

Set the Anthropic secret in your Supabase project:

```bash
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | User profile: name, goal, level, focus, equipment, duration |
| `workout_plans` | AI-generated workout plans with full plan JSON |
| `scheduled_workouts` | Calendar entries linking a plan to a date |
| `workout_logs` | Completed session records with timestamps and exercise counts |

---

## Project Structure

```
src/
├── components/
│   ├── app/          # Domain components (Navigation, WorkoutProgress, etc.)
│   └── ui/           # shadcn/ui primitives
├── contexts/         # AuthContext
├── hooks/            # useWorkoutSession, useQuickSession, useCoachChat, etc.
├── lib/
│   ├── exercises.ts  # Exercise definitions, FORM_SCORED_EXERCISES, sortSquatFirst
│   ├── squat-engine.ts  # Phase state machine + rep scoring
│   ├── pose-math.ts  # MediaPipe landmark → joint angles
│   └── voice.ts      # Web Speech API wrapper
├── pages/            # Route-level components
└── integrations/
    └── supabase/     # Generated types + client
supabase/
└── functions/        # Deno edge functions (Claude API calls)
```

---

## How the Form Scoring Works

1. **MediaPipe Pose** runs in a Web Worker and emits 33 3D landmarks at ~30 fps directly from the webcam feed.
2. **`pose-math.ts`** converts world landmarks into joint angles: knee flexion, torso lean from vertical, and bilateral asymmetry.
3. **`squat-engine.ts`** runs a phase state machine (`standing → descending → bottom → ascending`) on each frame, detecting rep boundaries by tracking knee angle with hysteresis.
4. On rep completion, a **score 0–100** is computed from: depth (parallel = minimum passing threshold), back lean, tempo, and asymmetry. Each metric contributes weighted deductions.
5. The **primary cue** (worst offense) is selected and spoken aloud via Web Speech API, with severity-matched audio tones (high = good, low = major fault).
6. A **risk accumulator** tracks repeated major faults; if it exceeds a threshold, a full-screen stop overlay fires.

All of this runs entirely in the browser. No video is uploaded anywhere.

---

## Roadmap

- [ ] Deadlift and bench press form scoring
- [ ] Progressive overload tracking across sessions
- [ ] Full workout history page
- [ ] Mobile app (React Native / Capacitor)
- [ ] Multi-user household mode
- [ ] Export session data (CSV / PDF)

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [MediaPipe](https://developers.google.com/mediapipe) — on-device pose estimation
- [Anthropic Claude](https://anthropic.com) — AI workout and nutrition generation
- [Supabase](https://supabase.com) — backend infrastructure
- [shadcn/ui](https://ui.shadcn.com) — component library
