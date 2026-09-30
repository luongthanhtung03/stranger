"use client";

import type { QualityStats } from "@/lib/webrtc";

export function QualityBadge({ stats, state }: { stats: QualityStats | null; state: RTCPeerConnectionState }) {
  if (state !== "connected" || !stats || !stats.height) return null;
  const good = stats.height >= 720 && stats.kbps >= 1200;
  const ok = stats.height >= 480 && stats.kbps >= 500;
  const color = good ? "bg-emerald-400" : ok ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-fg/80">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {stats.height}p · {stats.kbps >= 1000 ? `${(stats.kbps / 1000).toFixed(1)} Mbps` : `${stats.kbps} kbps`}
      {stats.rttMs ? ` · ${stats.rttMs}ms` : ""}
      {stats.relayed ? " · relay" : ""}
    </div>
  );
}
