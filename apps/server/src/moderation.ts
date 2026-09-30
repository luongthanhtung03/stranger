import { BAN_MS, REPORTS_TO_BAN } from "@stranger/shared";

// In-memory moderation: reports keyed by the reported deviceId.
// Beta only — restarts wipe state. Good enough until accounts exist.

const reports = new Map<string, Map<string, number>>(); // target -> reporter -> ts
const bans = new Map<string, number>(); // deviceId -> until (ms)

export function banUntil(deviceId: string): number | null {
  const until = bans.get(deviceId);
  if (!until) return null;
  if (until <= Date.now()) {
    bans.delete(deviceId);
    return null;
  }
  return until;
}

/** Records a report; returns the ban expiry if this report triggered a ban. */
export function report(reporter: string, target: string): number | null {
  if (reporter === target) return null;
  const now = Date.now();
  let byReporter = reports.get(target);
  if (!byReporter) {
    byReporter = new Map();
    reports.set(target, byReporter);
  }
  byReporter.set(reporter, now);
  for (const [r, ts] of byReporter) if (now - ts > BAN_MS) byReporter.delete(r);
  if (byReporter.size >= REPORTS_TO_BAN && !banUntil(target)) {
    const until = now + BAN_MS;
    bans.set(target, until);
    byReporter.clear();
    return until;
  }
  return null;
}
