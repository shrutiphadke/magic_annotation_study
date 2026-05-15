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




