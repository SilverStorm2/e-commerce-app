"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type FollowStoreButtonProps = {
  storeId: string;
  storeSlug: string;
  labels: {
    follow: string;
    following: string;
    toggling: string;
    hint: string;
  };
  initiallyFollowing?: boolean;
};

export function FollowStoreButton({ labels, initiallyFollowing = false }: FollowStoreButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => {
      setIsFollowing((current) => !current);
    });
  }

  return (
    <Button
      type="button"
      variant={isFollowing ? "secondary" : "outline"}
      onClick={handleToggle}
      aria-pressed={isFollowing}
      data-following={isFollowing}
      disabled={isPending}
      title={labels.hint}
    >
      {isPending ? labels.toggling : isFollowing ? labels.following : labels.follow}
    </Button>
  );
}
