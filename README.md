# daily-helper
slider with api motivational quotes and to do list

## Workout Log (`workout/`)

A mobile web app (PWA) for tracking gym workouts. No build step: it is plain HTML/CSS/JS.

- **Train**: start Workout A or B (the one you did least recently is marked *Up next*).
  Each exercise shows last time's result and a *Try …* suggestion (double progression:
  add reps up to the top of the range, then add weight). Includes a rest timer.
- **History**: every logged workout, editable.
- **Progress**: a table of your sessions, like the paper log. Green marks a better result
  than last time. Tap an exercise to see its chart.
- **Plans**: edit exercises, rep ranges and weight steps; export/import a JSON backup.

The app comes pre-loaded with the workouts from 12–26.10.2026. Data stays on the phone
(browser storage), so export a backup now and then.

### Put it on your phone
1. Host the repo with GitHub Pages (Settings → Pages → deploy from this branch, root folder).
   The app is then at `https://<user>.github.io/daily-helper/workout/`.
2. Open that URL on your phone:
   - iPhone (Safari): Share → **Add to Home Screen**
   - Android (Chrome): ⋮ menu → **Install app** / **Add to Home screen**
3. It opens full-screen like a native app and works offline.

To run it locally: `cd workout && python3 -m http.server` and open http://localhost:8000.
