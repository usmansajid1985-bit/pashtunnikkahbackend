"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PN-BACKEND-003: a stale admin tab (session revoked in another tab, or simply expired) throws
 * an unhandled exception on the next Server Action — Next.js's client runtime expects an
 * RSC/action-encoded response and instead gets middleware's redirect-to-login HTML. Without this
 * boundary that surfaces as a raw crash instead of a clean bounce back to Login.
 *
 * This can't distinguish "your session expired" from a genuine bug, so it offers both paths
 * rather than guessing and silently redirecting.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("[admin] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This can happen if your admin session expired or was signed out in another tab.
          </p>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => {
                router.push("/login");
                router.refresh();
              }}
            >
              Go to Login
            </Button>
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
