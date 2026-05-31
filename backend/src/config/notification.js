const admin = require('firebase-admin');
const twilio = require('twilio');

// Firebase Admin (FCM)
if (!admin.apps.length) {
  const serviceAccount = require(process.env.FCM_SERVICE_ACCOUNT_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// Twilio (SMS)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

module.exports = {
  fcm: admin.messaging(),
  twilioClient,
  TWILIO_FROM: process.env.TWILIO_PHONE_NUMBER,
};
