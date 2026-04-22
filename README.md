# Disaster Response Drone Pathfinding Engine

AI2002 academic project for weighted-grid pathfinding and visualization.

## Overview

This repository contains a client-server application for simulating drone pathfinding in a disaster environment. The backend computes routes on a weighted 2D grid, while the frontend lets users build scenarios visually and replay the search process.

Current implementation status:

- Implemented end-to-end: A* pathfinding
- Planned but not yet implemented: Uniform Cost Search (UCS)
- Interface: interactive web GUI
- Report: Markdown technical report prepared for Assignment 3

## Tech Stack

- Backend: Python 3.9+, FastAPI, Uvicorn, Pydantic
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4

## Repository Structure

```text
assignment-1/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── docs/
│   └── ASSIGNMENT_3_TECHNICAL_REPORT.md
├── frontend/
│   ├── app/
│   │   ├── DroneGrid.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── README.md
├── .gitignore
└── README.md
```

## Dependency Specifications

- Python dependencies: [backend/requirements.txt](backend/requirements.txt)
- Frontend dependencies: [frontend/package.json](frontend/package.json)

No external datasets are required for this project. All scenarios are created manually in the GUI or generated through the built-in randomization controls.

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend endpoints:

- `GET /health`
- `POST /calculate-path`

Default local backend URL:

- `http://localhost:8000`

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Default local frontend URL:

- `http://localhost:3000`

## How to Use the Application

1. Choose a grid size.
2. Place the start cell and goal cell.
3. Paint smoke, debris, or wall cells, or randomize the map.
4. Select the algorithm and animation speed.
5. Click `Calculate Path`.
6. Observe the explored cells, final route, and metrics.

## Terrain Cost Model

| Cell Type | Code | Cost |
|---|---:|---:|
| Free airspace | `0` | `1` |
| Smoke | `1` | `5` |
| Debris | `2` | `10` |
| Wall / Fire | `3` | impassable |

## API Contract

Request:

```json
{
  "grid": [[0, 1, 2, 3]],
  "start": [0, 0],
  "goal": [0, 3],
  "algorithm": "astar"
}
```

Response:

```json
{
  "explored_sequence": [[0, 0], [0, 1]],
  "optimal_path": [[0, 0], [0, 1]],
  "metrics": {
    "total_cost": 6,
    "nodes_expanded": 2
  }
}
```

## Known Limitations

- UCS is not implemented yet in the backend.
- The current diagonal movement model should be refined for stronger theoretical correctness.
- The current report still needs UML diagrams and GUI screenshots inserted before final PDF export.

## Assignment 3 Report

The technical report draft is available at:

- [docs/ASSIGNMENT_3_TECHNICAL_REPORT.md](docs/ASSIGNMENT_3_TECHNICAL_REPORT.md)

It already includes:

- algorithmic pseudocode
- architecture and UML placeholders
- annotated code snippets
- execution traces
- GUI screenshot placeholders
- limitations and future work

## Notes for Final Submission

Before final PDF submission and GitHub handoff:

- insert UML diagrams into the report placeholders
- insert GUI screenshots into the report placeholders
- clean the Git history and push from a proper root repository
- avoid committing local runtime folders such as `backend/venv`, `frontend/node_modules`, and `frontend/.next`
