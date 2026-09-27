import { useSyncExternalStore } from "react";
import { installState, promptInstall, subscribeInstall } from "@/lib/pwa";

export function useInstallApp() {
  const state = useSyncExternalStore(subscribeInstall, installState, () => "unsupported" as const);
  return { state, install: promptInstall };
}
