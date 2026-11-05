# Seerah Stories for Kids (حكايات السيرة للأطفال)

An Arabic timeline of the Prophet's life ﷺ for children. Each event opens a kid-friendly story; signed-in families can ask questions, get answers from Gemini grounded in Google Search under strict rules, and every answer is saved in a per-event notebook.

## How it fits together

| Piece | What it does |
|---|---|
| `public/` | The website (plain HTML/CSS/JS, no build step) |
| `public/js/stories.js` | The 12 stories on the timeline |
| `public/js/prompts.js` | The strict rules injected into every Gemini answer |
| `public/js/config.js` | Your Firebase keys, model name, daily question limit |
| Firebase Authentication | Google, Apple, Microsoft, Facebook, email/password sign-in |
| Firebase AI Logic | Calls Gemini with the Google Search tool from the page |
| Cloud Firestore | `qa` (saved answers), `usage` (daily limit), `admins` |
| `.github/workflows/deploy.yml` | Every push to `main` deploys the site and database rules |

## One-time setup

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and create a project (for example `seerah-kids`).
2. Add a **Web app** (Project settings → Your apps → `</>`). Copy the config values into `public/js/config.js`.
3. Put the project id in `.firebaserc`.
4. **Firestore Database** → Create database → Production mode → pick a US region.
5. **Upgrade to the Blaze plan** (pay as you go). Grounding with Google Search needs billing. Set a budget alert in Google Cloud Billing (for example $10/month).

### 2. Turn on Gemini
1. **AI Logic** (Build → AI Logic) → Get started → choose **Gemini Developer API**.
2. Pricing for grounded answers is on the Gemini API pricing page. The daily limit in `config.js` and `firestore.rules` (20 per person) keeps costs bounded.
3. Recommended: **App Check** → register the web app with **reCAPTCHA Enterprise**, paste the site key into `appCheckSiteKey` in `config.js`, then enforce App Check for AI Logic. This stops other sites from using your Gemini quota.

### 3. Turn on sign-in methods
Authentication → Sign-in method:
- **Email/Password**: enable.
- **Google**: enable (no extra accounts needed).
- **Microsoft**: create an app registration in Microsoft Entra ID (portal.azure.com), add the redirect URI Firebase shows you, paste the client id and secret.
- **Facebook**: create an app at developers.facebook.com, add *Facebook Login*, paste the app id and secret, and add the Firebase redirect URI in Facebook's settings.
- **Apple**: needs an Apple Developer account ($99/year). Create a Services ID and a key for *Sign in with Apple*, register your domain, and paste the details Firebase asks for.

Then Authentication → Settings → **Authorized domains**: add your hosting domain (and your custom domain if you add one).

### 4. Connect GitHub for automatic deploys
1. Google Cloud console → IAM → Service accounts → create one with the roles **Firebase Hosting Admin** and **Firebase Rules Admin** (and **Cloud Datastore Index Admin**). Create a JSON key.
2. GitHub repo → Settings → Secrets and variables → Actions → add:
   - `FIREBASE_SERVICE_ACCOUNT`: the full JSON key
   - `FIREBASE_PROJECT_ID`: your project id
3. Push to `main` (or run the workflow by hand). The site goes live at `https://<project-id>.web.app`.

### 5. Make yourself an admin (to delete anyone's answers)
Sign in once, copy your user id from Authentication → Users, then in Firestore create a document `admins/<your-user-id>` with any field (for example `role: "owner"`).

## Changing things later
- **Stories**: edit `public/js/stories.js` (each line: id, title, place · time, story, lesson, kid question). Keep the ids (`s1`, `s2`…) so saved answers stay attached.
- **Answer rules**: edit `ANSWER_RULES` in `public/js/prompts.js`.
- **Daily limit**: change `DAILY_QUESTION_LIMIT` in `config.js` and the matching `20` in `firestore.rules`.

## Notes
- Google's terms require showing **Search Suggestions** with grounded answers. The page shows them (in a sandboxed frame) under each answer, both live and in the notebook. Review the Gemini API terms on storing grounded results before opening the site to the public.
- The daily limit is enforced by Firestore rules, and App Check protects the Gemini endpoint. Without App Check, a determined person could call Gemini with your web config outside the page.
- Answers are AI-written; review them with your children.
