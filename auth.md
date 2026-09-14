# Google OAuth setup: Google Drive backup and Google Fit

Use this guide when Google shows **Error 400: redirect_uri_mismatch** or when setting up Google Drive / Google Fit for the first time.

## Why the error happens

Google only permits OAuth sign-in to a redirect URL registered on the OAuth client. The match is exact: `localhost` and `127.0.0.1` are different, and there must be no trailing `/`.

Workout OS currently uses these two exact callback URLs:

| Feature | Authorized redirect URI to add in Google Cloud |
|---|---|
| Google Drive backup | `http://localhost:10000/api/gdrive/callback` |
| Google Fit sync | `http://127.0.0.1:10000/api/google-fit/callback` |

Add **both** URLs to the same OAuth client so either feature works. Do not use `https`, do not add a trailing slash, and do not replace one URL with the other.

## 1. Create or open a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with the Google account that will own the OAuth configuration.
3. Use the project picker at the top of the page and select an existing project or click **New Project**.
4. Give it a name such as `Workout OS` and create it.

## 2. Configure the OAuth consent screen

1. Open **Google Auth Platform** → **Branding** (or **APIs & Services** → **OAuth consent screen** in the older console).
2. Choose **External** if friends with different Google accounts will use it.
3. Enter an app name, a support email, and your developer email.
4. Keep the app in **Testing** while you are testing. In **Audience**, add every Google account that will test it as a **Test user**.
5. Publish the app only when you are ready to manage Google's verification requirements for the requested scopes.

If a friend receives a “not verified” screen, they need to be listed as a test user while the app remains in Testing.

## 3. Enable the APIs

Open **APIs & Services** → **Library**, then enable:

- **Google Drive API** — required for cloud backups.
- **Fitness API** — required for Google Fit sync.

## 4. Create the OAuth client ID and secret

1. Open **Google Auth Platform** → **Clients** (or **APIs & Services** → **Credentials**).
2. Click **Create client** / **Create credentials** → **OAuth client ID**.
3. Choose **Web application**. This is required because Workout OS receives the result on its local server callbacks.
4. Name it `Workout OS Local PC`.
5. Under **Authorized redirect URIs**, add these as two separate entries:

   ```text
   http://localhost:10000/api/gdrive/callback
   http://127.0.0.1:10000/api/google-fit/callback
   ```

6. Click **Create**.
7. Copy the **Client ID** and **Client secret**. Store them securely; never commit them to GitHub or paste them into public release notes.

Google requires the redirect URI in an authorization request to exactly match a registered URI. See Google's [OAuth redirect URI documentation](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-mismatch).

## 5. Add the credentials in Workout OS

1. Start Workout OS and finish activation.
2. Open **Settings** → **Integrations**.
3. In **Google Fit Sync**, paste the Client ID and Client Secret, then save the settings.
4. For Drive, open **Settings** → **Data** → **Backup Health Center**. The same Client ID and Client Secret are used there.
5. Click **Authorize & Connect** for Google Fit, or **Connect Google Drive** for Drive.
6. Sign in to Google and approve the requested permissions.

If Drive or Fit still shows `redirect_uri_mismatch`, confirm all of the following:

- The Client ID in Workout OS belongs to the same OAuth client where you added the URLs.
- Both URLs above are present exactly as written.
- You waited a few minutes after saving the OAuth client changes.
- You did not accidentally use a Client ID from a different Google Cloud project.

## Privacy and sharing

Workout OS stores the Client Secret and refresh tokens encrypted on the local PC. It never uploads them to GitHub. Do not put a Client Secret in the installer, source code, screenshots, or a public repository.

Each friend can create their own Google Cloud project/client, or you can give them access to your project and have them use the same client. During testing, every friend's Google account must be added as a test user in the OAuth consent screen.
