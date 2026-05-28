# ParkiCare - Frontend

A web application designed to help caregivers manage and monitor Parkinson's disease patients. ParkiCare provides medication scheduling, nutrition planning, care event tracking, digital record management, and push notification reminders - all in a mobile-friendly, multilingual interface.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Available Scripts](#available-scripts)
- [Pages & Routing](#pages--routing)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [API Integration](#api-integration)
- [Push Notifications](#push-notifications)
- [Internationalisation](#internationalisation)
- [Contributing](#contributing)

---

## Tech Stack


| Category      | Technology                             |
| ------------- | -------------------------------------- |
| UI Library    | React 19                               |
| Language      | TypeScript 5                           |
| Build Tool    | Vite 7                                 |
| Routing       | React Router DOM 7                     |
| Styling       | Tailwind CSS 3                         |
| Animations    | Motion (Framer Motion) 12              |
| HTTP Client   | Axios 1                                |
| Icons         | Lucide React                           |
| Notifications | Firebase Messaging 12, Sonner (toasts) |
| Date Picker   | react-datepicker                       |
| Headless UI   | Radix UI (dropdown-menu, select)       |


---

## Project Structure

```
ParkiCare-frontend/
├── public/
│   ├── food/                    # Food item images
│   ├── Guide/                   # Guide section assets
│   ├── firebase-messaging-sw.js # Firebase push notification service worker
│   ├── home_video.mp4           # Hero video
│   └── site.webmanifest         # PWA manifest
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx    # Main layout: nav, language switcher, outlet
│   │   │   └── Footer.tsx
│   │   ├── CalendarWidget.tsx   # Calendar view for care events
│   │   └── HistorySection.tsx   # Event history display
│   ├── context/
│   │   ├── AuthContext.tsx          # Caregiver / patient session state
│   │   ├── CareEventsProvider.tsx   # Care events & medication state
│   │   ├── MedicationAlertContext.tsx
│   │   ├── NutritionCartContext.tsx
│   │   └── careEventsContext.ts     # Shared types for events & medications
│   ├── hooks/
│   │   ├── useCareEvents.ts
│   │   └── usePushNotifications.ts  # Firebase FCM token registration
│   ├── lib/
│   │   ├── api.ts               # Axios instance + error interceptor
│   │   ├── firebase.ts          # Firebase app initialisation
│   │   └── eventRecurrence.ts   # Recurrence logic (daily, weekly, one-off) in MYT
│   ├── pages/                   # One file per route
│   ├── routes/                  # Route tree definition
│   ├── services/                # API call functions (one file per domain)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                # Tailwind layers + custom animations
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.cjs
├── tsconfig.json
└── tsconfig.app.json
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A running instance of the [ParkiCare backend](../ParkiCare-backend/) (default: `http://localhost:8080`)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ParkiCare-frontend

# Install dependencies
npm install
```

### Running the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

---

## Environment Configuration

There is no `.env` file required for a basic local setup.

### API Base URL

File: [src/lib/api.ts](src/lib/api.ts)

```ts
// Development
baseURL: "http://localhost:8080/api"

// Production (update this before deploying)
baseURL: "https://<your-backend-domain>/api"
```

### Firebase Configuration

File: [src/lib/firebase.ts](src/lib/firebase.ts)

The Firebase project (`parkicare-my`) is configured for push notifications. 

---

## Available Scripts


| Command           | Description                                   |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the Vite development server with HMR    |
| `npm run build`   | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally          |
| `npm run lint`    | Run ESLint across all source files            |


---

## Pages & Routing


| Path                 | Page                   | Description                             |
| -------------------- | ---------------------- | --------------------------------------- |
| `/`                  | `LoadingScreenPage`    | Splash / loading screen                 |
| `/login`             | `LoginPage`            | Caregiver login                         |
| `/register`          | `RegisterPage`         | New account registration                |
| `/patient-setup`     | `PatientSetupPage`     | Initial patient profile setup           |
| `/profile`           | `ProfilePage`          | Caregiver & patient profile management  |
| `/home`              | `DashboardPage`        | Main dashboard (wrapped in `AppLayout`) |
| `/guide`             | `GuidePage`            | Educational content for caregivers      |
| `/knowledge-hub`     | `PerkinsDetailsPage`   | Parkinson's disease information hub     |
| `/care-events`       | `CareEventsPage`       | Medication and care event scheduling    |
| `/digital-records`   | `DigitalRecordsPage`   | Medical document storage with OCR       |
| `/nutrition-library` | `NutritionLibraryPage` | Searchable nutrition database           |
| `/recipes`           | `RecipesPage`          | Recipe suggestions for patients         |
| `*`                  | Redirect               | Catch-all → `/`                         |


All authenticated pages are rendered inside `AppLayout`, which provides the navigation bar, language switcher, and footer.

---

## Key Features

### Care Event Management

Schedule, edit, and track medication doses, home care tasks, and outdoor events. Supports multiple recurrence patterns: one-off, daily, weekdays-only, and weekly. All date calculations are performed in **Malaysia Time (MYT / UTC+8)**.

### Medication Alerts

Active medication reminders are surfaced through `MedicationAlertContext`. Route guards keep caregivers informed of pending doses.

### Nutrition Library

A searchable food database with flip-card UI, drawn from a normalised food dataset. Paired with a nutrition cart for building meal plans.

### Recipe Suggestions

Curated recipes suited to Parkinson's patient dietary needs.

### Digital Records & OCR

Upload and store medical documents. OCR processing (`/src/services/ocr.ts`) extracts text content from scanned files.

### Push Notifications

Firebase Cloud Messaging (FCM) is integrated to deliver medication reminders to caregivers even when the browser tab is closed. See [Push Notifications](#push-notifications) for setup details.

### Calendar Widget

A full-featured calendar (`CalendarWidget.tsx`) visualises all care events and medication schedules with animated transitions.

---

## Architecture Overview

### Provider Pattern

The app wraps its route tree in a hierarchy of context providers:

```
AuthContext
└── CareEventsProvider
    └── MedicationAlertContext
        └── NutritionCartContext
            └── <Routes>
```

### Service Layer

All API calls are isolated in `src/services/`. Each file maps to a backend domain:


| File                           | Domain                                 |
| ------------------------------ | -------------------------------------- |
| `auth.ts`                      | Login & registration                   |
| `careEvents.ts`                | Medications, home care, outdoor events |
| `caregiverSchedule.ts`         | Caregiver availability                 |
| `caregiverEventOccurrences.ts` | Occurrence completion tracking         |
| `dashboard.ts`                 | Dashboard summary data                 |
| `drugs.ts`                     | Drug reference database                |
| `mealSchedule.ts`              | Meal planning                          |
| `nutrition.ts`                 | Nutrition data                         |
| `ocr.ts`                       | Document OCR                           |
| `patient.ts`                   | Patient profile                        |
| `pushNotifications.ts`         | FCM token registration                 |
| `recipe.ts`                    | Recipe data                            |


### Axios Instance

`src/lib/api.ts` exports a pre-configured Axios instance pointed at the backend base URL. A response error interceptor normalises all error messages into a standard `Error` object before they reach calling code.

### Path Alias

`@` is aliased to `./src` in both Vite and TypeScript config. Use `@/components/...`, `@/services/...` etc. in imports.

---

## API Integration

The backend is a Spring Boot REST API. The frontend expects it at:

```
http://localhost:8080/api   (development default)
```

All requests go through the shared Axios instance in [src/lib/api.ts](src/lib/api.ts). Ensure the backend is running and accessible before starting the frontend dev server.

---

## Push Notifications

ParkiCare uses **Firebase Cloud Messaging** to send medication reminders.

1. The service worker at `public/firebase-messaging-sw.js` handles background messages.
2. On first login, `usePushNotifications.ts` requests notification permission and registers the FCM token with the backend via `src/services/pushNotifications.ts`.
3. To use your own Firebase project, replace the config object in `src/lib/firebase.ts` and update the `firebase-messaging-sw.js` service worker with the matching config.

> Push notifications require HTTPS in production. They will not work over plain HTTP except on `localhost`.

---

## Internationalisation (Upcoming)

The app supports three languages, selectable from the navigation bar:

- English (`en`)
- 中文 - Chinese (`zh`)
- Bahasa Melayu (`ms`)

Language selection is managed inside `AppLayout.tsx`. If you are adding new UI strings, ensure they are added for all three locales.

---

## Contributing

1. Branch off `main` using a descriptive branch name.
2. Run `npm run lint` and fix any warnings before opening a PR.
3. Run `npm run build` to confirm the TypeScript build passes.
4. Open a pull request targeting `main` and request a review.

