"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { applyDataSaver, openCamera, stopStream } from "./media";
import { getDataSaver, setDataSaver as persistDataSaver } from "./identity";

// Keeps the camera stream alive across landing → queue → room so the user
// never sees a second permission prompt or a black frame while matching.

interface Ctx {
  stream: MediaStream | null;
  error: string | null;
  micOn: boolean;
  camOn: boolean;
  dataSaver: boolean;
  open: () => Promise<MediaStream | null>;
  release: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  setDataSaver: (on: boolean) => void;
}

const MediaCtx = createContext<Ctx | null>(null);

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [dataSaver, setSaver] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Loaded after mount: the provider wraps every page, so SSR renders it too.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSaver(getDataSaver()), []);

  const open = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    try {
      const s = await openCamera();
      if (getDataSaver()) await applyDataSaver(s, true);
      streamRef.current = s;
      setStream(s);
      setError(null);
      setMicOn(true);
      setCamOn(true);
      return s;
    } catch (err) {
      setError((err as Error).name ?? "error");
      return null;
    }
  }, []);

  const release = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  const toggleMic = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const on = !s.getAudioTracks()[0]?.enabled;
    s.getAudioTracks().forEach((t) => (t.enabled = on));
    setMicOn(on);
  }, []);

  const toggleCam = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const on = !s.getVideoTracks()[0]?.enabled;
    s.getVideoTracks().forEach((t) => (t.enabled = on));
    setCamOn(on);
  }, []);

  const setDataSaver = useCallback((on: boolean) => {
    persistDataSaver(on);
    setSaver(on);
    if (streamRef.current) void applyDataSaver(streamRef.current, on);
  }, []);

  useEffect(() => () => stopStream(streamRef.current), []);

  return (
    <MediaCtx.Provider
      value={{ stream, error, micOn, camOn, dataSaver, open, release, toggleMic, toggleCam, setDataSaver }}
    >
      {children}
    </MediaCtx.Provider>
  );
}

export function useMedia() {
  const ctx = useContext(MediaCtx);
  if (!ctx) throw new Error("useMedia outside MediaProvider");
  return ctx;
}
