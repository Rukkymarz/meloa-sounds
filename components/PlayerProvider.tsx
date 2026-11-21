"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

interface PlayerCtx {
  current: Track | null;
  queue: Track[];
  index: number;
  status: Status;
  error: string | null;
  position: number;
  duration: number;
  playList: (list: Track[], startAt: number) => void;
  playOne: (t: Track) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  ytMountRef: React.RefObject<HTMLDivElement | null>;
}

const Ctx = createContext<PlayerCtx | null>(null);
export const usePlayer = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside PlayerProvider");
  return c;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<void> | null = null;
function loadYouTubeApi() {
  if (ytReady) return ytReady;
  ytReady = new Promise<void>((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytReady;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [current, setCurrent] = useState<Track | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<any>(null);
  const ytMountRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  queueRef.current = queue;
  indexRef.current = index;

  // one shared <audio> element
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    const onTime = () => setPosition(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnd = () => goTo(indexRef.current + 1);
    const onPlay = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "loading" ? s : "paused"));
    const onErr = () => {
      setStatus("error");
      setError("This stream couldn't be played. Skipping…");
      setTimeout(() => goTo(indexRef.current + 1), 1500);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      a.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // poll YouTube position
  useEffect(() => {
    if (current?.playback.kind !== "youtube") return;
    const id = setInterval(() => {
      const p = ytRef.current;
      if (p?.getCurrentTime) {
        setPosition(p.getCurrentTime() || 0);
        setDuration(p.getDuration() || 0);
      }
    }, 500);
    return () => clearInterval(id);
  }, [current]);

  const stopAll = () => {
    audioRef.current?.pause();
    try {
      ytRef.current?.stopVideo?.();
    } catch {}
  };

  const start = useCallback(async (t: Track) => {
    stopAll();
    setError(null);
    setPosition(0);
    setDuration(t.durationSec || 0);
    setStatus("loading");

    // resolve metadata-only rows (Deezer, Archive) to a full legal source
    let track = t;
    if (t.playback.kind === "resolve") {
      try {
        const r = await fetch(`/api/resolve?source=${t.playback.source}&id=${encodeURIComponent(t.playback.id)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        track = { ...t, ...j.track, id: t.id, title: t.title || j.track.title, artist: t.artist || j.track.artist, artwork: t.artwork || j.track.artwork };
      } catch (e: any) {
        setCurrent(t);
        setStatus("error");
        setError(e.message || "No full version found.");
        return;
      }
    }
    setCurrent(track);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        artwork: track.artwork ? [{ src: track.artwork, sizes: "512x512" }] : [],
      });
    }

    const pb = track.playback;
    if (pb.kind === "audio") {
      const a = audioRef.current!;
      a.src = pb.url;
      a.play().catch(() => setStatus("paused"));
    } else if (pb.kind === "youtube") {
      await loadYouTubeApi();
      await new Promise((r) => setTimeout(r, 0)); // let the dock become visible first
      const mount = ytMountRef.current;
      if (!mount) return;
      if (ytRef.current?.loadVideoById) {
        ytRef.current.loadVideoById(pb.videoId);
      } else {
        const el = document.createElement("div");
        mount.innerHTML = "";
        mount.appendChild(el);
        ytRef.current = new window.YT.Player(el, {
          videoId: pb.videoId,
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: window.location.origin },
          events: {
            onStateChange: (e: any) => {
              if (e.data === 1) setStatus("playing");
              if (e.data === 2) setStatus("paused");
              if (e.data === 0) goTo(indexRef.current + 1);
            },
            onError: () => {
              setStatus("error");
              setError("YouTube won't play this video here. Skipping…");
              setTimeout(() => goTo(indexRef.current + 1), 1500);
            },
          },
        });
      }
    } else if (pb.kind === "embed") {
      setStatus("playing"); // the platform's own player takes over
    } else {
      setStatus("error");
      setError("Not playable.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const q = queueRef.current;
      if (i < 0 || i >= q.length) {
        setStatus("paused");
        return;
      }
      setIndex(i);
      start(q[i]);
    },
    [start],
  );

  const playList = useCallback(
    (list: Track[], startAt: number) => {
      setQueue(list);
      queueRef.current = list;
      goTo(startAt);
    },
    [goTo],
  );

  const playOne = useCallback((t: Track) => playList([t], 0), [playList]);

  const toggle = useCallback(() => {
    const pb = current?.playback;
    if (pb?.kind === "audio") {
      const a = audioRef.current!;
      a.paused ? a.play() : a.pause();
    } else if (pb?.kind === "youtube" && ytRef.current) {
      status === "playing" ? ytRef.current.pauseVideo() : ytRef.current.playVideo();
    }
  }, [current, status]);

  const seek = useCallback(
    (sec: number) => {
      if (current?.playback.kind === "audio" && audioRef.current) audioRef.current.currentTime = sec;
      if (current?.playback.kind === "youtube") ytRef.current?.seekTo?.(sec, true);
      setPosition(sec);
    },
    [current],
  );

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => {
    if (position > 5) return seek(0);
    goTo(indexRef.current - 1);
  }, [goTo, position, seek]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }, [toggle, next, prev]);

  return (
    <Ctx.Provider value={{ current, queue, index, status, error, position, duration, playList, playOne, toggle, next, prev, seek, ytMountRef }}>
      {children}
    </Ctx.Provider>
  );
}
