import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppwriteException, Permission, Role, type Models } from "appwrite";
import {
  account,
  appwriteConfig,
  databases,
  isAppwriteConfigured,
  signInWithGitHub,
  signOut as appwriteSignOut,
} from "@/lib/appwrite";
import { syncLocalRuns } from "@/lib/cloud";
import { startAccountSync } from "@/lib/account-sync";
import { ensureHistoryIds, getSettings, getStreak, saveSettings } from "@/utils/storage";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  configured: boolean;
  syncStatus: SyncStatus;
  login: () => void;
  logout: () => Promise<void>;
  retrySync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function githubUsernameFromUser(user: Models.User<Models.Preferences>): string | undefined {
  const preferences = user.prefs as Record<string, unknown>;
  const preferenceUsername = preferences.githubUsername;
  if (typeof preferenceUsername === "string" && preferenceUsername.trim()) return preferenceUsername.trim();
  if (user.email.includes("@users.noreply.github.com")) return user.email.split("@")[0].replace(/^\d+\+/, "");
  return undefined;
}

interface GitHubIdentityProfile {
  login: string;
  name: string | null;
  avatar_url: string;
}

async function getGitHubProfile(): Promise<GitHubIdentityProfile | null> {
  if (!account) return null;
  try {
    const identities = await account.listIdentities();
    const github = identities.identities.find((identity) => identity.provider === "github");
    if (!github?.providerAccessToken) return null;
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${github.providerAccessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) return null;
    return await response.json() as GitHubIdentityProfile;
  } catch {
    return null;
  }
}

async function ensureProfile(user: Models.User<Models.Preferences>): Promise<void> {
  if (!databases) return;

  const githubProfile = await getGitHubProfile();
  const profileData = {
    githubUsername: githubProfile?.login || githubUsernameFromUser(user),
    displayName: githubProfile?.name || user.name || undefined,
    avatarUrl: githubProfile?.avatar_url || undefined,
  };

  try {
    const existing = await databases.getDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.profilesCollectionId,
      documentId: user.$id,
    });
    const needsUpdate = profileData.githubUsername !== existing.githubUsername
      || profileData.displayName !== existing.displayName
      || (profileData.avatarUrl && profileData.avatarUrl !== existing.avatarUrl);
    if (needsUpdate) {
      await databases.updateDocument({
        databaseId: appwriteConfig.databaseId,
        collectionId: appwriteConfig.profilesCollectionId,
        documentId: user.$id,
        data: profileData,
      });
    }
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 404) throw error;

    const owner = Role.user(user.$id);
    const streak = getStreak();
    await databases.createDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.profilesCollectionId,
      documentId: user.$id,
      data: {
        ...profileData,
        currentStreak: streak.current,
        bestStreak: streak.best,
        lastActiveDate: streak.lastDate ? new Date(`${streak.lastDate}T12:00:00`).toISOString() : undefined,
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(owner),
        Permission.delete(owner),
      ],
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(isAppwriteConfigured);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  const retrySync = useCallback(async () => {
    if (!user) return;
    setSyncStatus("syncing");
    try {
      await syncLocalRuns(user.$id, ensureHistoryIds());
      setSyncStatus("synced");
    } catch (syncError) {
      console.error("Unable to sync local runs", syncError);
      setSyncStatus("error");
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }

    try {
      const currentUser = await account.get();
      setUser(currentUser);
      const cloudGoals = (currentUser.prefs as Record<string, unknown>).dailyGoals;
      if (cloudGoals && typeof cloudGoals === "object") {
        const settings = getSettings();
        saveSettings({ ...settings, goals: { ...settings.goals, ...(cloudGoals as Partial<typeof settings.goals>) } });
      }
      await ensureProfile(currentUser);
      setSyncStatus("syncing");
      void syncLocalRuns(currentUser.$id, ensureHistoryIds())
        .then(() => setSyncStatus("synced"))
        .catch((syncError) => {
          console.error("Unable to sync local runs", syncError);
          setSyncStatus("error");
        });
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 401) {
        setUser(null);
      } else {
        console.error("Unable to load Appwrite session", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Settings, preferences, streak, duels, arcade scores and runs follow the account.
  useEffect(() => {
    startAccountSync(user?.$id ?? null);
  }, [user?.$id]);

  const logout = useCallback(async () => {
    await appwriteSignOut();
    setUser(null);
    setSyncStatus("idle");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: isAppwriteConfigured,
    syncStatus,
    login: signInWithGitHub,
    logout,
    retrySync,
  }), [user, loading, syncStatus, logout, retrySync]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
