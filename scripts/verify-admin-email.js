// One-off: marks ADMIN_EMAIL's Firebase Auth account as email-verified.
//
// /login now rejects unverified email/password sign-ins (see src/routes/auth.ts).
// That rule applies uniformly, including to the admin account -- so the admin
// needs this run once rather than the login code special-casing ADMIN_EMAIL.
// Safe to re-run; it's a no-op if the account is already verified or doesn't
// exist yet (e.g. the admin hasn't signed up through the site yet).
//
// Usage: node scripts/verify-admin-email.js

require('dotenv').config();
const admin = require('firebase-admin');

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, ADMIN_EMAIL } = process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error('Missing FIREBASE_ADMIN_* credentials in .env');
  process.exit(1);
}
if (!ADMIN_EMAIL) {
  console.error('Missing ADMIN_EMAIL in .env');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(ADMIN_EMAIL);
    if (user.emailVerified) {
      console.log(`Already verified: ${ADMIN_EMAIL}`);
      return;
    }
    await admin.auth().updateUser(user.uid, { emailVerified: true });
    console.log(`Marked verified: ${ADMIN_EMAIL}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`No account yet for ${ADMIN_EMAIL} -- nothing to do. It will need` +
        ` this script re-run after the admin signs up, or will verify normally via email.`);
      return;
    }
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
})();
