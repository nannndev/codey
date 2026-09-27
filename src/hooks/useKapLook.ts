import { useEffect, useState } from "react";
import { SYNC_EVENT } from "@/lib/account-sync";
import { ACHIEVEMENT_EVENT } from "@/lib/achievements";
import { LOOK_EVENT, LOOK_KEY, readLook } from "@/lib/kap-wardrobe";
import type { KapLook } from "@/components/streak/kap-skins";

/** The look Kap wears everywhere, kept current across tabs, devices and new badges. */
export function useKapLook(): KapLook {
  const [look, setLook] = useState<KapLook>(() => readLook());

  useEffect(() => {
    const refresh = () => setLook(readLook());
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOOK_KEY || event.key === null) refresh();
    };
    window.addEventListener(LOOK_EVENT, refresh);
    window.addEventListener(ACHIEVEMENT_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LOOK_EVENT, refresh);
      window.removeEventListener(ACHIEVEMENT_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return look;
}
