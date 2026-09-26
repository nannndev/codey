import { useEffect } from "react";
import { useStreak } from "@/hooks/useStreak";
import { lastNotifiedOn, markNotified, readReminder, reminderDue, reminderMessage, notificationsSupported } from "@/lib/streak-reminder";

/** Fires Kap's evening reminder while a Codey tab is open. Renders nothing. */
export function StreakReminder() {
  const status = useStreak();

  useEffect(() => {
    const check = () => {
      if (!notificationsSupported() || Notification.permission !== "granted") return;
      const now = new Date();
      if (!reminderDue(readReminder(), status, now, lastNotifiedOn())) return;
      markNotified(now);
      const { title, body } = reminderMessage(status);
      try {
        const notification = new Notification(title, { body, icon: "/app-icon-192.png", badge: "/app-icon-192.png", tag: "codey-streak" });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Some browsers only allow notifications from a service worker.
      }
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [status]);

  return null;
}
