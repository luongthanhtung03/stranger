// Camera/mic acquisition tuned for clear video, with graceful fallbacks.

const HQ: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: "user",
  },
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

const SD: MediaStreamConstraints = {
  video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
  audio: true,
};

export async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(HQ);
  } catch (err) {
    // OverconstrainedError on cheap webcams → retry with relaxed constraints.
    if ((err as DOMException).name === "OverconstrainedError") {
      return navigator.mediaDevices.getUserMedia(SD);
    }
    throw err;
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Lower the capture resolution/frame rate to save data; `false` restores HQ. */
export async function applyDataSaver(stream: MediaStream, on: boolean) {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    await track.applyConstraints(
      on
        ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 20 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    );
  } catch {
    /* some devices reject live constraint changes — bitrate cap still applies */
  }
}
