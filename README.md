# Study — Local Development Version

Self-hosted version of the study, runs entirely on your laptop. No internet, no Google Sheets, no Prolific account needed for testing.

## Quick start

1. **Drop your stimulus files** into `stimuli/`:
   ```
   stimuli/
   ├── about/
   │   ├── a953d9d2.../main.html
   │   └── ...
   ├── products/
   │   └── ...
   └── css/
       └── ...
   ```
   The paths must match what's in `config.json`. If you have your existing `data/` folder, just rename it to `stimuli/` and move it here.

2. **Start the server** (from this folder):
   ```bash
   python server.py
   ```
   (Python 3.7+ — no `pip install` needed, uses only the standard library.)

3. **Open the study** in your browser:
   ```
   http://localhost:8000/?PROLIFIC_PID=TEST123&STUDY_ID=S1&SESSION_ID=X1
   ```

4. **Check your responses**:
   ```
   responses/responses.csv
   ```
   Open it in Excel, Google Sheets, or any text editor. Rows are appended as participants submit each pair.

## What's running

- The Python server serves the static files (`index.html`, `app.js`, etc.) and the `stimuli/` folder.
- When the survey submits a response, it POSTs JSON to `/submit`, which the server appends to `responses/responses.csv`.
- All 51 pairs and 10 questions are pre-loaded in `config.json`.

## Testing tips

- **Quick iteration**: set `"pairs_per_participant": 1` in `config.json` while testing the UI so you don't have to fill out 50 questions per refresh.
- **Reset responses**: just delete `responses/responses.csv` — it'll be recreated with headers on next submit.
- **Multiple test participants**: change the `PROLIFIC_PID` in the URL each time, or just refresh — each session is independent.
- **Inspect what's being sent**: open the browser's DevTools (F12) → Network tab → click on the `/submit` request to see the JSON.

## Folder structure

```
study_local/
├── server.py              ← run this
├── index.html             ← landing/consent
├── survey.html            ← main survey
├── thanks.html            ← completion (no Prolific redirect locally)
├── app.js                 ← controller
├── styles.css             ← styling
├── config.json            ← pairs, questions, endpoint
├── stimuli/               ← YOUR HTML/CSS FILES GO HERE
└── responses/
    └── responses.csv      ← auto-created on first submit
```

## When you're ready to deploy publicly

The local version and the hosted version share 95% of the code. The two differences are:

1. **`config.json` → `sheets_endpoint`**: locally `/submit`, publicly your Google Apps Script URL.
2. **`app.js` → `sendToSheets`**: locally we send normal JSON; publicly we use `mode: "no-cors"` and `text/plain` because that's what Apps Script accepts.

You'll find both versions of the files in the main project. For now, focus on getting the UI right locally.
# magic_annotation_study
