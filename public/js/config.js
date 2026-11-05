// Fill these in from Firebase console → Project settings → Your apps → Web app.
// These values are public by design; security comes from Firestore rules and App Check.
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// reCAPTCHA Enterprise site key for App Check (protects your Gemini quota from abuse).
// Leave empty to run without App Check while testing.
export const appCheckSiteKey = "";

// Gemini model used for grounded answers. Change here to switch models.
export const GEMINI_MODEL = "gemini-2.5-flash";

// Questions each signed-in person can ask per day (search grounding is billed per prompt).
export const DAILY_QUESTION_LIMIT = 20;
