# Body OS 4.5.62

## Reliable AI reports and email

- A workout is saved before AI analysis or email delivery begins.
- Reports only send after valid AI analysis succeeds; failed delivery is queued and can be retried from the Dashboard.
- Report emails include point-by-point AI recommendations.
- Email testing now gives safe, specific Gmail guidance instead of the vague “Request failed” message.

## AI connection

- The selected provider key is used consistently by testing and report generation.
- Test AI automatically falls back from a temporarily rate-limited selected free model to `openrouter/free`.
- Provider errors identify the provider, model, HTTP status, and the next step.

## Google connections and readiness

- One saved Google OAuth credential is reused by Google Fit and Google Drive while each service remains separately authorized.
- Saved Google Fit credentials remain hidden after restart; use **Replace credential JSON** only when changing them.
- Google Fit import clearly shows connecting, reading, imported, no-data, and error states.
- Overnight sleep is imported from Google Fit sleep sessions and assigned to the day it ends, ready for that day’s readiness check-in.
