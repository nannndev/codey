#!/usr/bin/env node
/**
 * Prints a fresh VAPID key pair for Web Push. Put the values in Vercel
 * (Project → Settings → Environment Variables) and redeploy:
 *
 *   VAPID_PUBLIC_KEY   the public key (the app reads it from /api/push/config)
 *   VAPID_PRIVATE_KEY  the private key: keep it secret, never commit it
 *   VAPID_SUBJECT      mailto:you@example.com (who push services can contact)
 *   CRON_SECRET        any long random string, so only Vercel Cron can run reminders
 */
import crypto from "node:crypto";
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log(`CRON_SECRET=${crypto.randomBytes(24).toString("hex")}`);
