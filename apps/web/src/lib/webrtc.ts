import type { IceServer, RtcSignal } from "@stranger/shared";

// 1:1 peer connection using the "perfect negotiation" pattern.
// Quality choices: prefer VP9, cap bitrate high enough for crisp 720p,
// keep resolution over frame rate when the network gets tight.

export interface QualityStats {
  width: number;
  height: number;
  fps: number;
  kbps: number; // inbound video bitrate
  rttMs: number;
  relayed: boolean; // going through TURN
}

export interface PeerHandle {
  pc: RTCPeerConnection;
  handleSignal: (signal: RtcSignal) => Promise<void>;
  setDataSaver: (on: boolean) => Promise<void>;
  close: () => void;
}

const HQ_BITRATE = 2_500_000;
const SAVER_BITRATE = 500_000;

function preferCodecs(pc: RTCPeerConnection) {
  const caps = RTCRtpReceiver.getCapabilities?.("video");
  if (!caps) return;
  const rank = (c: RTCRtpCodec) => {
    const m = c.mimeType.toLowerCase();
    if (m === "video/vp9") return 0;
    if (m === "video/h264") return 1;
    if (m === "video/vp8") return 2;
    return 3; // rtx/red/ulpfec/av1 etc. keep their relative order
  };
  const sorted = [...caps.codecs].sort((a, b) => rank(a) - rank(b));
  for (const tr of pc.getTransceivers()) {
    if (tr.sender.track?.kind === "video" && typeof tr.setCodecPreferences === "function") {
      try {
        tr.setCodecPreferences(sorted);
      } catch {
        /* unsupported codec list on this browser — defaults are fine */
      }
    }
  }
}

async function applyBitrate(pc: RTCPeerConnection, maxBitrate: number) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxBitrate;
    // Non-standard but honored by Chromium; sharp picture beats smooth motion here.
    (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
      maxBitrate >= HQ_BITRATE ? "maintain-resolution" : "balanced";
    try {
      await sender.setParameters(params);
    } catch {
      /* Safari may reject degradationPreference; ignore */
    }
  }
}

export function createPeer(opts: {
  iceServers: IceServer[];
  initiator: boolean;
  localStream: MediaStream;
  dataSaver: boolean;
  sendSignal: (s: RtcSignal) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onState: (state: RTCPeerConnectionState) => void;
  onStats?: (stats: QualityStats) => void;
}): PeerHandle {
  const pc = new RTCPeerConnection({
    iceServers: opts.iceServers as RTCIceServer[],
    bundlePolicy: "max-bundle",
  });
  const polite = !opts.initiator;
  let makingOffer = false;
  let ignoreOffer = false;

  for (const track of opts.localStream.getTracks()) pc.addTrack(track, opts.localStream);
  preferCodecs(pc);

  const remote = new MediaStream();
  pc.ontrack = (ev) => {
    remote.addTrack(ev.track);
    opts.onRemoteStream(remote);
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) opts.sendSignal({ type: "ice", candidate: ev.candidate.toJSON() });
  };

  // Only the initiator offers. Letting both sides offer at once (glare) made
  // Chrome roll back the polite side's offer and then never gather ICE
  // candidates for it, so the call hung in "connecting".
  pc.onnegotiationneeded = async () => {
    if (!opts.initiator) return;
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      opts.sendSignal({ type: "sdp", sdp: pc.localDescription! });
    } catch (err) {
      console.warn("[rtc] negotiation failed", err);
    } finally {
      makingOffer = false;
    }
  };

  pc.onconnectionstatechange = () => {
    opts.onState(pc.connectionState);
    if (pc.connectionState === "connected") {
      void applyBitrate(pc, opts.dataSaver ? SAVER_BITRATE : HQ_BITRATE);
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") pc.restartIce();
  };

  // Signals must be applied strictly in order (offer before its candidates).
  let chain: Promise<void> = Promise.resolve();
  const handleSignal = (signal: RtcSignal) => {
    chain = chain.then(() => applySignal(signal));
    return chain;
  };

  const applySignal = async (signal: RtcSignal) => {
    try {
      if (signal.type === "sdp") {
        const desc = signal.sdp;
        const collision = desc.type === "offer" && (makingOffer || pc.signalingState !== "stable");
        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(desc);
        if (desc.type === "offer") {
          await pc.setLocalDescription();
          opts.sendSignal({ type: "sdp", sdp: pc.localDescription! });
        }
      } else {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!ignoreOffer) throw err;
        }
      }
    } catch (err) {
      console.warn("[rtc] signal error", err);
    }
  };

  // Stats poll → quality badge.
  let lastBytes = 0;
  let lastTs = 0;
  const statsTimer = setInterval(async () => {
    if (!opts.onStats || pc.connectionState !== "connected") return;
    try {
      const report = await pc.getStats();
      const q: QualityStats = { width: 0, height: 0, fps: 0, kbps: 0, rttMs: 0, relayed: false };
      let selectedPair: RTCIceCandidatePairStats | undefined;
      const local = new Map<string, { candidateType?: string }>();
      report.forEach((s) => {
        if (s.type === "inbound-rtp" && s.kind === "video") {
          const now = s.timestamp as number;
          const bytes = (s.bytesReceived as number) ?? 0;
          if (lastTs) q.kbps = Math.round(((bytes - lastBytes) * 8) / ((now - lastTs) / 1000) / 1000);
          lastBytes = bytes;
          lastTs = now;
          q.width = s.frameWidth ?? 0;
          q.height = s.frameHeight ?? 0;
          q.fps = Math.round(s.framesPerSecond ?? 0);
        } else if (s.type === "candidate-pair" && (s as RTCIceCandidatePairStats).state === "succeeded" && s.nominated) {
          selectedPair = s as RTCIceCandidatePairStats;
        } else if (s.type === "local-candidate") {
          local.set(s.id, s as { candidateType?: string });
        }
      });
      if (selectedPair) {
        q.rttMs = Math.round((selectedPair.currentRoundTripTime ?? 0) * 1000);
        q.relayed = local.get(selectedPair.localCandidateId)?.candidateType === "relay";
      }
      if (q.kbps > 0) opts.onStats(q); // first sample has no delta yet
    } catch {
      /* stats are best-effort */
    }
  }, 2000);

  return {
    pc,
    handleSignal,
    setDataSaver: (on) => applyBitrate(pc, on ? SAVER_BITRATE : HQ_BITRATE),
    close: () => {
      clearInterval(statsTimer);
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onnegotiationneeded = null;
      pc.close();
    },
  };
}
