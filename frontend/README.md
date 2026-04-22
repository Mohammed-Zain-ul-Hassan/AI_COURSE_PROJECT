# Frontend

This folder contains the Next.js frontend for the Disaster Response Drone Pathfinding Engine.

## Responsibilities

- render the interactive weighted grid
- allow start and goal placement
- support terrain painting and randomized scenario generation
- send pathfinding requests to the backend API
- animate explored cells and final path output
- display metrics and status messages

## Main Files

- `app/page.tsx`: main dashboard, API requests, animation flow, metrics panel
- `app/DroneGrid.tsx`: interactive grid editor, paint tools, randomization, overlays
- `app/layout.tsx`: global HTML shell and metadata
- `app/globals.css`: shared styling

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

Local development URL:

- `http://localhost:3000`

## Notes

- The frontend expects the backend API to be available at `http://localhost:8000`.
- The UCS option is visible in the interface, but the backend currently returns `501 Not Implemented` for that selection.
