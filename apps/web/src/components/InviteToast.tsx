"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { useSocket } from "@/lib/socket";
import { t } from "@/i18n/vi";

// Global "call again" invite banner — visible on any page.
export function InviteToast() {
  const { invite, socket, dismissInvite } = useSocket();
  const router = useRouter();

  const accept = () => {
    if (!invite) return;
    socket.emit("friend:accept", { inviteId: invite.inviteId });
    dismissInvite();
    router.push("/");
  };
  const decline = () => {
    if (!invite) return;
    socket.emit("friend:decline", { inviteId: invite.inviteId });
    dismissInvite();
  };

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="glass fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3"
        >
          <Avatar name={invite.from.name} size={44} />
          <div className="min-w-0 flex-1 text-sm font-medium">{t.inviteFrom(invite.from.name)}</div>
          <motion.button whileTap={{ scale: 0.94 }} onClick={decline} className="rounded-full px-3 py-2 text-sm text-muted">
            {t.decline}
          </motion.button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={accept} className="grad glow rounded-full px-4 py-2 text-sm font-bold">
            {t.accept}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
