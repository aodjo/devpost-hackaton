# OpenRoute

OpenRoute is a mobile navigation app that helps users avoid accessibility obstacles (stairs, blocked paths, elevator issues, etc.) by using community reports and map-based route search.

## Before You Read

> This document is translated with AI based on the [Korean document](/README-ko.md).
> If there is any conflict between the two documents, the [Korean document](/README-ko.md) takes precedence.

## Project Overview

- Searches walking routes and displays reported obstacles along the route.
- Supports place search (autocomplete + place details).
- Allows new obstacle reporting with photo upload.
- Serves map tiles through a FastAPI-based tile proxy.

## Tech Stack

- Client: Expo + React Native
- Server: FastAPI (Python)
- Database: SQLite
- External APIs: Google Maps Tiles, Places, Directions, OAuth

## Project Notion (Written in Korean)

https://www.notion.so/Devpost-Hackaton-30e3a23b48228055bb33d9ab99aa22a8

## Repository Structure

```text
.
|-- client/   # Expo React Native app
`-- server/   # FastAPI API + SQLite logic
```

## Quick Start

### 1) Start the server

```bash
cd server
python -m pip install -r requirements.txt
python main.py
```

Required environment variable:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Optional environment variables (for Google login):

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:8000/callback/google
```

### 2) Start the client

```bash
cd client
npm install
npm run start
```

Useful commands:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`

## Main API Endpoints

- `GET /health`
- `GET /maps/tiles/{z}/{x}/{y}.png`
- `POST /places/search/text`
- `GET /places/autocomplete`
- `POST /directions/walking`
- `POST /warning/add_place`

## Notes

- Obstacle reports and user data are stored in SQLite (`app.db`).
- The transit tab is currently a placeholder.
- This is a hackathon-stage project and is still being improved.

## License

This project is licensed under MIT. See `LICENSE` for details.
