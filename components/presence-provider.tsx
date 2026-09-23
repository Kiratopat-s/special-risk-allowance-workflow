"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import {
  DISABLED_PRESENCE,
  PresenceController,
  type PresenceState,
} from "@/lib/presence/client";

const PresenceContext = createContext<PresenceState>(DISABLED_PRESENCE);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const [controller] = useState(() => new PresenceController(update));
  useEffect(() => { controller.setSessionRecheck(update); }, [controller, update]);
  const presence = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  // update() keeps the current session while status is "loading". Do not treat
  // this refresh as logout and inadvertently clear the controller's 401 guard.
  const userId = status !== "unauthenticated" && !session?.error
    ? session?.user?.dbUserId ?? null
    : null;

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  useEffect(() => { controller.setUserId(userId); }, [controller, userId]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceState {
  return useContext(PresenceContext);
}
