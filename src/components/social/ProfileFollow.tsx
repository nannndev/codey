import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { fetchRelation } from "@/lib/social";
import { FollowButton } from "./FollowButton";

/** Follower counts on a profile, and a Follow button when it is someone else's. */
export function ProfileFollow({ userId, own }: { userId: string; own: boolean }) {
  const { user, login } = useAuth();
  const [relation, setRelation] = useState<{ followers: number; following: number; isFollowing: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void fetchRelation(userId).then((next) => active && setRelation(next), () => active && setRelation(null));
    return () => {
      active = false;
    };
  }, [userId, user]);

  return (
    <div className="flex items-center gap-2">
      {relation && (
        <Link to="/league#friends" className="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <span><b className="font-mono text-foreground">{relation.followers}</b> followers</span>
          <span><b className="font-mono text-foreground">{relation.following}</b> following</span>
        </Link>
      )}
      {!own && (user ? (
        <FollowButton
          userId={userId}
          initial={relation?.isFollowing ?? false}
          onChange={(following) => setRelation((current) => current && { ...current, isFollowing: following, followers: current.followers + (following ? 1 : -1) })}
        />
      ) : (
        <button type="button" onClick={login} className="flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer">
          Sign in to follow
        </button>
      ))}
    </div>
  );
}
