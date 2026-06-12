import * as admin from "firebase-admin";

function initFirebaseAdmin(): admin.app.App | null {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const serviceAccount = JSON.parse(json) as admin.ServiceAccount;
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  return null;
}

export function getFirebaseAdmin(): admin.app.App | null {
  return initFirebaseAdmin();
}

export async function verifyIdToken(
  authorizationHeader: string | null
): Promise<admin.auth.DecodedIdToken | null> {
  const app = getFirebaseAdmin();
  if (!app || !authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice(7);
  try {
    return await admin.auth(app).verifyIdToken(token);
  } catch {
    return null;
  }
}
