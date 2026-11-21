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
  nowPlayingOpen: boolean;
  setNowPlayingOpen: (open: boolean) => void;
  playList: (list: Track[], startAt: number) => void;
  playOne: (t: Track) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  canControl: boolean;
  ytMountRef: React.RefObject<HTMLDivElement | null>;
  saved: Track[];
  history: Track[];
  isSaved: (t: Track | null) => boolean;
  toggleSave: (t: Track) => void;
  storageOk: boolean;
  needsSound: boolean;
  turnOnSound: () => void;
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

// Library storage lives in this browser (no account system yet).
const SAVED_KEY = "meloa:saved";
const HISTORY_KEY = "meloa:history";
const slim = (t: Track): Track => {
  const { alternates, ...rest } = t;
  return rest;
};
function readList(key: string): Track[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch {
    return null;
  }
}
function writeList(key: string, list: Track[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [current, setCurrent] = useState<Track | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [saved, setSaved] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [storageOk, setStorageOk] = useState(true);
  const [needsSound, setNeedsSound] = useState(false);
  const soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytReadyRef = useRef(false);
  const ytAltsRef = useRef<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<any>(null);
  const ytMountRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  queueRef.current = queue;
  indexRef.current = index;

  // Load YouTube's player script early so the first YouTube song starts faster.
  useEffect(() => {
    const t = setTimeout(() => loadYouTubeApi(), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const s = readList(SAVED_KEY);
    const h = readList(HISTORY_KEY);
    if (s === null || h === null) setStorageOk(false);
    setSaved(s || []);
    setHistory(h || []);
  }, []);

  const remember = (t: Track) => {
    setHistory((prev) => {
      const next = [slim(t), ...prev.filter((x) => x.id !== t.id)].slice(0, 40);
      writeList(HISTORY_KEY, next);
      return next;
    });
  };

  const isSaved = useCallback((t: Track | null) => !!t && saved.some((x) => x.id === t.id), [saved]);
  const toggleSave = useCallback((t: Track) => {
    setSaved((prev) => {
      const next = prev.some((x) => x.id === t.id) ? prev.filter((x) => x.id !== t.id) : [slim(t), ...prev];
      if (!writeList(SAVED_KEY, next)) setStorageOk(false);
      return next;
    });
  }, []);

  // If a song's player fails, try the next verified player saved for the same song.
  const fallbackRef = useRef<() => boolean>(() => false);

  // one shared <audio> element for the whole app session
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
      if (!a.src) return;
      if (fallbackRef.current()) return;
      setStatus("error");
      setError("This stream couldn't be played. Skipping to the next song.");
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
      a.removeAttribute("src");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (soundTimer.current) clearTimeout(soundTimer.current);
    setNeedsSound(false);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    try {
      ytRef.current?.stopVideo?.();
    } catch {}
  };

  const start = useCallback(async (t: Track) => {
    // This runs inside the listener's tap, the only moment iPhones allow sound to be
    // switched on. YouTube remembers "muted" between songs (and visits), so undo it here.
    try {
      const yt = ytRef.current;
      if (yt?.isMuted?.()) yt.unMute();
      yt?.setVolume?.(100);
    } catch {}
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
    }
    setNeedsSound(false);
    stopAll();
    setError(null);
    setPosition(0);
    setDuration(t.durationSec || 0);
    setStatus("loading");
    setCurrent(t);

    let track = t;
    if (t.playback.kind === "resolve") {
      try {
        const r = await fetch(`/api/resolve?source=${t.playback.source}&id=${encodeURIComponent(t.playback.id)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        track = { ...t, ...j.track, id: t.id, title: t.title || j.track.title, artist: t.artist || j.track.artist, artwork: t.artwork || j.track.artwork };
      } catch (e: any) {
        setStatus("error");
        setError(e.message || "No full-length version found.");
        return;
      }
    }
    setCurrent(track);
    remember(track);
    prefetchNext();

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
      ytAltsRef.current = [...(pb.alts || [])];
      await loadYouTubeApi();
      await new Promise((r) => setTimeout(r, 0)); // let the video frame become visible first
      const mount = ytMountRef.current;
      if (!mount) return;
      if (ytRef.current?.loadVideoById && ytReadyRef.current) {
        ytRef.current.loadVideoById(pb.videoId);
        checkStarted();
      } else if (!ytRef.current) {
        const el = document.createElement("div");
        mount.innerHTML = "";
        mount.appendChild(el);
        ytRef.current = new window.YT.Player(el, {
          videoId: pb.videoId,
          width: "100%",
          height: "100%",
          // Meloa draws its own controls; YouTube's video, ads and branding stay visible.
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, controls: 0, fs: 0, iv_load_policy: 3, disablekb: 1, origin: window.location.origin },
          events: {
            onReady: (e: any) => {
              ytReadyRef.current = true;
              try {
                e.target.playVideo();
              } catch {}
              checkStarted();
            },
            onStateChange: (e: any) => {
              if (e.data === 1) {
                setStatus("playing");
                try {
                  if (e.target.isMuted?.()) setNeedsSound(true); // playing silently: offer "Turn on sound"
                } catch {}
                if (soundTimer.current) clearTimeout(soundTimer.current);
              }
              if (e.data === 2) setStatus("paused");
              if (e.data === 0) goTo(indexRef.current + 1);
            },
            onError: () => {
              // Some uploads refuse to play outside YouTube: try the next official upload first.
              const alt = ytAltsRef.current.shift();
              if (alt) {
                ytRef.current?.loadVideoById(alt);
                checkStarted();
                return;
              }
              if (fallbackRef.current()) return;
              setStatus("error");
              setError("This song won't play outside YouTube. Skipping to the next song.");
              setTimeout(() => goTo(indexRef.current + 1), 1500);
            },
          },
        });
      } else {
        // player still loading: queue this video for when it's ready
        setTimeout(() => {
          try {
            ytRef.current?.loadVideoById(pb.videoId);
            checkStarted();
          } catch {}
        }, 800);
      }
    } else if (pb.kind === "embed") {
      setStatus("playing"); // the platform's own player takes over
    } else if (pb.kind === "external") {
      setStatus("idle"); // handed off: shown with an "Open in …" button
    } else {
      setStatus("error");
      setError("This song can't be played.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // iPhones block sound when playback starts after a network wait. If YouTube hasn't
  // started shortly after loading, start it muted and offer a one-tap "Turn on sound".
  function checkStarted(attempt = 0) {
    if (soundTimer.current) clearTimeout(soundTimer.current);
    soundTimer.current = setTimeout(() => {
      const yt = ytRef.current;
      if (!yt?.getPlayerState) {
        if (attempt < 5) checkStarted(attempt + 1);
        return;
      }
      const st = yt.getPlayerState();
      if (st === 1) {
        if (yt.isMuted?.()) setNeedsSound(true);
        return;
      }
      if (st === 3 && attempt < 4) return checkStarted(attempt + 1); // still buffering
      try {
        yt.mute();
        yt.playVideo();
        setNeedsSound(true);
      } catch {}
    }, 1200);
  }

  // Find the next song's full version in the background, so tapping Next starts instantly.
  function prefetchNext() {
    const i = indexRef.current + 1;
    const nxt = queueRef.current[i];
    if (!nxt || nxt.playback.kind !== "resolve") return;
    fetch(`/api/resolve?source=${nxt.playback.source}&id=${encodeURIComponent(nxt.playback.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.track || queueRef.current[i]?.id !== nxt.id) return;
        const ready = { ...nxt, ...j.track, id: nxt.id, title: nxt.title, artist: nxt.artist, artwork: nxt.artwork || j.track.artwork };
        const q = [...queueRef.current];
        q[i] = ready;
        queueRef.current = q;
        setQueue(q);
      })
      .catch(() => {});
  }

  const turnOnSound = useCallback(() => {
    const yt = ytRef.current;
    try {
      yt?.unMute();
      yt?.setVolume?.(100);
      yt?.playVideo();
    } catch {}
    setNeedsSound(false);
  }, []);

  fallbackRef.current = () => {
    const c = current;
    const fb = c?.fallbacks?.[0];
    if (!c || !fb) return false;
    start({ ...c, playback: fb, fallbacks: c.fallbacks!.slice(1) });
    return true;
  };

  const goTo = useCallback(
    (i: number) => {
      const q = queueRef.current;
      if (i < 0 || i >= q.length) {
        setStatus((s) => (s === "playing" ? "paused" : s));
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

  const kind = current?.playback.kind;
  const canControl = kind === "audio" || kind === "youtube";

  const toggle = useCallback(() => {
    if (kind === "audio") {
      const a = audioRef.current!;
      a.paused ? a.play() : a.pause();
    } else if (kind === "youtube" && ytRef.current) {
      if (status === "playing") ytRef.current.pauseVideo();
      else {
        try {
          ytRef.current.unMute();
          ytRef.current.setVolume?.(100);
        } catch {}
        setNeedsSound(false);
        ytRef.current.playVideo();
      }
    }
  }, [kind, status]);

  const seek = useCallback(
    (sec: number) => {
      if (kind === "audio" && audioRef.current) audioRef.current.currentTime = sec;
      if (kind === "youtube") ytRef.current?.seekTo?.(sec, true);
      setPosition(sec);
    },
    [kind],
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
    <Ctx.Provider
      value={{
        current, queue, index, status, error, position, duration,
        nowPlayingOpen, setNowPlayingOpen,
        playList, playOne, toggle, next, prev, seek, canControl, ytMountRef,
        saved, history, isSaved, toggleSave, storageOk, needsSound, turnOnSound,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
