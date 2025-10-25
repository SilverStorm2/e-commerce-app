"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let mounted = true;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
          scope: "/",
        });

        if (mounted) {
          // Trigger an update check on page focus to keep the shell fresh.
          const handleVisibility = () => {
            if (document.visibilityState === "visible") {
              registration.update().catch(() => undefined);
            }
          };

          document.addEventListener("visibilitychange", handleVisibility);

          return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
          };
        }

        return undefined;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Service worker registration failed", error);
        }
        return undefined;
      }
    };

    const cleanupPromise = register();

    return () => {
      mounted = false;
      cleanupPromise.then((cleanup) => {
        cleanup?.();
      });
    };
  }, []);

  return null;
}
