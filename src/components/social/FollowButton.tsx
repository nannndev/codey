import { useEffect, useState } from "react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followPlayer, unfollowPlayer } from "@/lib/social";

/** Follow or unfollow a player; the server's answer decides the state shown. */
export function FollowButton({ userId, initial, onChange }: { userId: string; initial: boolean; onChange?: (following: boolean) => void }) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setFollowing(initial), [initial]);
  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "outline" : "default"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const next = following ? (await unfollowPlayer(userId)).following : (await followPlayer(userId)).following;
          setFollowing(next);
          onChange?.(next);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : following ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
