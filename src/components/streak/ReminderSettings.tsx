import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { SYNC_EVENT } from "@/lib/account-sync";
import { enableNotifications, notificationsSupported, readReminder, REMINDER_EVENT, REMINDER_HOURS, writeReminder } from "@/lib/streak-reminder";
import { cn } from "@/lib/utils";

const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** "Remind me at 8 PM if I haven't practiced", inside the streak panel. */
export function ReminderSettings() {
  const [settings, setSettings] = useState(readReminder);
  const [blocked, setBlocked] = useState(() => notificationsSupported() && Notification.permission === "denied");

  useEffect(() => {
    const refresh = () => setSettings(readReminder());
    window.addEventListener(REMINDER_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    return () => {
      window.removeEventListener(REMINDER_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
    };
  }, []);

  if (!notificationsSupported()) return null;

  const toggle = async () => {
    if (settings.enabled) {
      writeReminder({ ...settings, enabled: false });
      return;
    }
    const allowed = await enableNotifications();
    setBlocked(!allowed && Notification.permission === "denied");
    if (allowed) writeReminder({ ...settings, enabled: true });
  };

  return (
    <div className="mt-3 rounded-lg border bg-card/60 p-3 text-xs">
      <div className="flex items-center gap-2.5">
        {settings.enabled ? <Bell className="size-4 shrink-0 text-amber-500" /> : <BellOff className="size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Remind me</p>
          <p className="text-muted-foreground">{blocked ? "Notifications are blocked for this site in your browser settings." : "If I haven't practiced, while Codey is open in a tab."}</p>
        </div>
        <select
          value={settings.hour}
          onChange={(event) => writeReminder({ ...settings, hour: Number(event.target.value) })}
          disabled={!settings.enabled}
          className="rounded-md border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
          aria-label="Reminder time"
        >
          {REMINDER_HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
        </select>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Streak reminders"
          onClick={() => void toggle()}
          disabled={blocked && !settings.enabled}
          className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50", settings.enabled ? "bg-amber-500" : "bg-muted-foreground/30")}
        >
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", settings.enabled ? "left-[18px]" : "left-0.5")} />
        </button>
      </div>
    </div>
  );
}
