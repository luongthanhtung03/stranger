"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/i18n/vi";
import { GOOGLE_CLIENT_ID } from "@/lib/auth-config";
import { useSocket } from "@/lib/socket";
import { useTheme } from "@/lib/theme";

// Google Identity Services button. Only rendered when AUTH_ENABLED, so the
// beta never loads Google's script. The ID token goes straight to our server,
// which checks it and the .edu.vn domain, then hands back our own session.

const GSI_SRC = "https://accounts.google.com/gsi/client";

interface Gsi {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
}

let loading: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  const w = window as unknown as { google?: Gsi };
  if (w.google?.accounts) return Promise.resolve(w.google);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("gsi")));
    s.onerror = () => {
      loading = null;
      reject(new Error("gsi"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function GoogleSignIn({ onSignedIn }: { onSignedIn: (name: string) => void }) {
  const { signInWithGoogle } = useSocket();
  const { theme } = useTheme();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onSignedInRef = useRef(onSignedIn);
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then((gsi) => {
        if (cancelled || !btnRef.current) return;
        gsi.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            setBusy(true);
            setError(null);
            const res = await signInWithGoogle(credential);
            setBusy(false);
            if (res.ok) onSignedInRef.current(res.name);
            else setError(res.error === "domain" ? t.signInDomain : t.signInFailed);
          },
        });
        btnRef.current.replaceChildren();
        gsi.accounts.id.renderButton(btnRef.current, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          locale: "vi",
          width: Math.min(360, btnRef.current.offsetWidth || 320),
        });
      })
      .catch(() => !cancelled && setError(t.signInFailed));
    return () => {
      cancelled = true;
    };
  }, [signInWithGoogle, theme]);

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass glow flex flex-col items-center gap-3 rounded-[var(--radius-card)] p-5 text-center"
    >
      <motion.span
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }}
        className="grad grid h-11 w-11 place-items-center rounded-full text-white"
      >
        <GraduationCap size={22} />
      </motion.span>
      <div>
        <p className="font-extrabold">{t.signInTitle}</p>
        <p className="mt-1 text-xs text-muted">{t.signInSub}</p>
      </div>
      <div ref={btnRef} className={`flex min-h-[44px] w-full justify-center ${busy ? "pointer-events-none opacity-50" : ""}`} />
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-xs font-semibold text-accent-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
