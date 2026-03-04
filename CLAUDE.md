# FDSO Knowledge Base — Claude Code Guide

## Project Overview

This is the **FDSO Knowledge Base** web application — a React/TypeScript SPA for the FDSO organization that supports foreign technical workers (特定技能外国人) in Japan.

The app has four main views:
| View | Description |
|------|-------------|
| ダッシュボード | Overview dashboard showing document counts and quick navigation |
| 対話型マニュアル | AI chat interface powered by Gemini for querying the knowledge base |
| ナレッジ管理 | CRUD interface for managing internal knowledge documents |
| 会議スケジューラー | Meeting scheduler that generates Japanese business-style emails and Google Calendar links |

---

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build tool**: Vite
- **Styling**: Tailwind CSS (CDN via `index.html`)
- **AI**: `@google/genai` (Gemini)
- **Storage**: IndexedDB via `idb`
- **Fonts**: Inter + Noto Sans JP (Google Fonts)

---

## Project Structure

```
/
├── index.html           # HTML entry point — Tailwind CDN config and importmap
├── index.tsx            # React root mount
├── App.tsx              # Root component, view routing, sidebar integration
├── types.ts             # Shared TypeScript types and enums (ViewMode, DocumentItem, etc.)
├── constants.ts         # Initial seed documents and Gemini system instruction
├── vite.config.ts       # Vite configuration
├── components/
│   ├── Sidebar.tsx          # Left navigation sidebar
│   ├── DashboardHome.tsx    # Dashboard view
│   ├── ChatInterface.tsx    # Gemini-powered chat view
│   ├── KnowledgeManager.tsx # Document CRUD view
│   └── MeetingScheduler.tsx # Meeting scheduler view
└── services/
    ├── geminiService.ts  # Gemini API integration
    └── storageService.ts # IndexedDB CRUD wrapper
```

---

## Key Conventions

### Adding a New View
1. Add the view name to the `ViewMode` enum in `types.ts`
2. Create the component in `components/`
3. Add a menu entry to the `menuItems` array in `components/Sidebar.tsx`
4. Add a `case` in the `renderContent` switch in `App.tsx`

### Styling
- All colours use the custom `fdso-*` palette defined in `index.html`'s Tailwind config (maps to sky/blue tones)
- Tailwind utility classes throughout — no separate CSS files
- Japanese text uses Noto Sans JP; UI chrome uses Inter

### Storage
- `storageService` wraps IndexedDB via `idb`; all document CRUD goes through it
- `DocumentItem` is the primary stored entity

---

## Meeting Scheduler Feature

The `MeetingScheduler` component (`components/MeetingScheduler.tsx`) is fully client-side — no API calls.

**Inputs:**
- 会議タイトル (meeting title)
- 会議の目的 (meeting purpose / description)
- 参加候補者メールアドレス (attendee emails, dynamic list)
- 候補日時1〜3 (up to 3 candidate date/time ranges)

**Outputs:**
- A formal Japanese business-style invitation email (打診メール) with copy-to-clipboard
- Google Calendar `TEMPLATE` links for each candidate date (opens in new tab)

**Google Calendar URL format:**
```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=<title>
  &details=<purpose>
  &dates=<YYYYMMDDTHHmmss>/<YYYYMMDDTHHmmss>
  &add=<email1>&add=<email2>
```

---

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # TypeScript compile + Vite build
npm run preview  # preview production build
```
