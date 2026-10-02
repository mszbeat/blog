'use client';

/**
 * Render gates for session-dependent chrome.
 *
 * Server components cannot know who is signed in (their data is fetched
 * anonymously), so guest-only affordances such as the "Join us" CTA must be
 * filtered on the client. Both gates render NOTHING until the session probe has
 * settled, which keeps two things true at once:
 *
 *   • No hydration mismatch — server and first client render both output null.
 *   • No flash — a signed-in user never sees a guest CTA appear and vanish.
 */

import { useAuth } from '@/lib/auth-context';

export function WhenSignedOut({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady || user) return null;
  return <>{children}</>;
}

export function WhenSignedIn({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady || !user) return null;
  return <>{children}</>;
}
