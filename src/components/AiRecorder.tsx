/*
MIT License

Copyright (c) 2026 Manjunath Irukulla

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
 * The call recorder of תמלול שיחות — Tweenly's AI recorder (MIT, above), fitted
 * to the console: its colours and Hebrew labels, the microphone settings a
 * speakerphone call needs, and `onDelete` so the page knows when a recording
 * was thrown away. The recording lives only in this page's memory.
 */

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from "motion/react";
import { Check, Download, Mic, MicOff, Pause, Play, RotateCcw, Trash2 } from "lucide-react";

export interface AiRecorderProps {
  /** Called after stop with the recorded audio and its duration. */
  onRecordingComplete?: (blob: Blob, durationMs: number) => void;
  /** Called when a recording is discarded (while recording) or deleted (after it). */
  onDelete?: () => void;
  /** Microphone to use; the browser's default when empty. */
  deviceId?: string;
  /** Called once microphone access was granted — device names are readable from then on. */
  onPermission?: () => void;
  /** Stop automatically after this many seconds. Default: no limit. */
  maxDuration?: number;
  /** Bits per second of the recording. Default: the browser's. */
  bitrate?: number;
  /** Colour of the stop button, recording dot and played waveform. */
  accent?: string;
  /** Height of the control in px. Default: 44 */
  size?: number;
  className?: string;
}

type Phase = "idle" | "requesting" | "recording" | "paused" | "recorded" | "denied" | "unavailable";
type Recording = { url: string | null; duration: number; peaks: number[] };

const PEAKS = 36;
const SAMPLE_MS = 50;
const BAR = 2.5;
const BAR_GAP = 2;
const spring: Transition = { type: "spring", stiffness: 450, damping: 36 };
const ease = [0.22, 1, 0.36, 1] as const;

const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const toPeaks = (levels: number[]) => {
  if (!levels.length) return Array.from({ length: PEAKS }, () => 0.1);
  const out: number[] = [];
  for (let i = 0; i < PEAKS; i++) {
    const a = Math.floor((i / PEAKS) * levels.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / PEAKS) * levels.length));
    let m = 0;
    for (let j = a; j < b && j < levels.length; j++) m = Math.max(m, levels[j]);
    out.push(m);
  }
  const max = Math.max(...out, 0.05);
  return out.map((v) => clamp(0.12 + (v / max) * 0.88));
};

function IconButton({
  label,
  onClick,
  children,
  className,
  style,
  dim,
  reduced,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  dim: number;
  reduced: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={reduced ? undefined : { scale: 0.9 }}
      transition={spring}
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-500",
        className,
      )}
      style={{ width: dim, height: dim, ...style }}
    >
      {children}
    </motion.button>
  );
}

export function AiRecorder({
  onRecordingComplete,
  onDelete,
  deviceId,
  onPermission,
  maxDuration,
  bitrate,
  accent = "var(--color-ink-700)",
  size = 44,
  className,
}: AiRecorderProps) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [rec, setRec] = useState<Recording | null>(null);
  const [playing, setPlaying] = useState(false);
  const [posSec, setPosSec] = useState(0);
  const [announce, setAnnounce] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const levelsRef = useRef<number[]>([]);
  const baseRef = useRef(0);
  const segRef = useRef(0);
  const durationRef = useRef(0);
  const cancelRef = useRef(false);
  const urlRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const phaseRef = useRef<Phase>("idle");
  const live = useRef({ onRecordingComplete, onDelete, maxDuration });
  const finishRef = useRef<(commit: boolean) => void>(() => {});

  const progress = useMotionValue(0);
  const clip = useTransform(progress, (p) => `inset(0 ${(1 - p) * 100}% 0 0)`);

  const inner = Math.max(24, size - 12);
  const icon = Math.round(inner * 0.5);
  const capturing = phase === "recording" || phase === "paused";

  useEffect(() => {
    live.current = { onRecordingComplete, onDelete, maxDuration };
    phaseRef.current = phase;
  });

  const release = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  };

  const elapsedNow = () => baseRef.current + (phaseRef.current === "recording" ? performance.now() - segRef.current : 0);

  const begin = () => {
    levelsRef.current = [];
    baseRef.current = 0;
    segRef.current = performance.now();
    phaseRef.current = "recording";
    setElapsed(0);
    setPhase("recording");
    setAnnounce("ההקלטה התחילה");
  };

  const finalize = (blob: Blob, duration: number) => {
    if (!aliveRef.current) return;
    release();
    if (cancelRef.current) {
      setPhase("idle");
      setAnnounce("ההקלטה בוטלה");
      live.current.onDelete?.();
      return;
    }
    const url = blob.size ? URL.createObjectURL(blob) : null;
    urlRef.current = url;
    progress.set(0);
    setPosSec(0);
    setRec({ url, duration, peaks: toPeaks(levelsRef.current) });
    setPhase("recorded");
    setAnnounce(`ההקלטה הסתיימה, ${fmt(duration)}`);
    live.current.onRecordingComplete?.(blob, duration);
  };

  const finish = (commit: boolean) => {
    const duration = elapsedNow();
    durationRef.current = duration;
    cancelRef.current = !commit;
    phaseRef.current = "idle";
    const r = recorderRef.current;
    recorderRef.current = null;
    if (r && r.state !== "inactive") r.stop();
    else finalize(new Blob([], { type: "audio/webm" }), duration);
  };

  useEffect(() => {
    finishRef.current = finish;
  });

  const start = async () => {
    setPhase("requesting");
    setAnnounce("מבקש גישה למיקרופון");
    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new DOMException("Recording unsupported", "NotSupportedError");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        // The other side comes out of the phone's speaker: filtering it as noise or echo would cut it.
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
    } catch (err) {
      if (!aliveRef.current) return;
      const name = err instanceof DOMException ? err.name : "";
      const denied = name === "NotAllowedError" || name === "SecurityError";
      setPhase(denied ? "denied" : "unavailable");
      setAnnounce(denied ? "אין גישה למיקרופון" : "לא נמצא מיקרופון");
      return;
    }
    if (!aliveRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    onPermission?.();
    streamRef.current = stream;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      ctx.createMediaStreamSource(stream).connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // The waveform is optional; recording still works.
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: bitrate });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      finalize(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }), durationRef.current);
    };
    recorderRef.current = recorder;
    recorder.start(1000); // a chunk a second, so a long call is never one huge buffer at the end
    begin();
  };

  const pause = () => {
    baseRef.current += performance.now() - segRef.current;
    phaseRef.current = "paused";
    recorderRef.current?.pause();
    setPhase("paused");
    setAnnounce("ההקלטה הושהתה");
  };

  const resume = () => {
    segRef.current = performance.now();
    phaseRef.current = "recording";
    recorderRef.current?.resume();
    setPhase("recording");
    setAnnounce("ההקלטה ממשיכה");
  };

  const remove = () => {
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPlaying(false);
    setRec(null);
    setPhase("idle");
    setAnnounce("ההקלטה נמחקה");
    live.current.onDelete?.();
  };

  // Leaving the page stops the microphone and frees the recording.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const r = recorderRef.current;
      recorderRef.current = null;
      if (r && r.state !== "inactive") {
        r.onstop = null;
        r.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close().catch(() => {});
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  // Capture loop: samples the level, draws the live waveform, drives the timer.
  useEffect(() => {
    if (!capturing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    let raf = 0;
    let lastSample = performance.now();
    let shownSec = -1;
    let fill = "currentColor";
    let W = 0;
    let H = 0;
    const samples: number[] = [];
    const buf = new Uint8Array(512);

    const resize = () => {
      if (!canvas || !ctx) return;
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fill = getComputedStyle(canvas).color;
    };
    resize();

    const level = () => {
      const an = analyserRef.current;
      if (!an) return 0;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < an.fftSize && i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      return clamp(Math.sqrt(sum / Math.min(an.fftSize, buf.length)) * 4.5);
    };

    const tick = (now: number) => {
      const recording = phaseRef.current === "recording";
      if (recording) {
        while (now - lastSample >= SAMPLE_MS) {
          lastSample += SAMPLE_MS;
          const v = level();
          samples.push(v);
          levelsRef.current.push(v);
          if (samples.length > 160) samples.shift();
        }
        const ms = baseRef.current + now - segRef.current;
        const sec = Math.floor(ms / 1000);
        if (sec !== shownSec) {
          shownSec = sec;
          setElapsed(ms);
        }
        const max = live.current.maxDuration;
        if (max && ms >= max * 1000) {
          finishRef.current(true);
          return;
        }
      } else {
        lastSample = now;
      }

      if (canvas && ctx) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = fill;
        const step = BAR + BAR_GAP;
        const shift = recording && !reduced ? ((now - lastSample) / SAMPLE_MS) * step : 0;
        const count = Math.ceil(W / step) + 1;
        for (let i = 0; i < count; i++) {
          const v = samples[samples.length - 1 - i] ?? 0;
          const x = W - BAR - i * step - shift + step;
          if (x < -BAR) break;
          const h = Math.max(BAR, v * H);
          // Bars fade toward the left edge.
          const edge = clamp(x / (W * 0.25));
          ctx.globalAlpha = (recording ? 0.85 : 0.35) * edge;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, (H - h) / 2, BAR, h, BAR / 2);
          else ctx.rect(x, (H - h) / 2, BAR, h);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [capturing, reduced]);

  // Playback loop.
  useEffect(() => {
    if (!playing || !rec) return;
    let raf = 0;
    let shown = -1;
    const tick = () => {
      const a = audioRef.current;
      const ms = a ? a.currentTime * 1000 : 0;
      const frac = clamp(ms / rec.duration);
      progress.set(frac);
      const sec = Math.floor((frac * rec.duration) / 1000);
      if (sec !== shown) {
        shown = sec;
        setPosSec(sec);
      }
      if (frac >= 1 || a?.ended) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rec, progress]);

  const seek = (frac: number) => {
    if (!rec) return;
    const f = clamp(frac);
    progress.set(f);
    setPosSec(Math.floor((f * rec.duration) / 1000));
    const a = audioRef.current;
    if (rec.url && a) a.currentTime = (f * rec.duration) / 1000;
  };

  const togglePlay = () => {
    if (!rec?.url) return;
    const a = audioRef.current;
    if (playing) {
      a?.pause();
      setPlaying(false);
      return;
    }
    if (progress.get() >= 0.999) seek(0);
    a?.play().catch(() => setPlaying(false));
    setPlaying(true);
  };

  const seekFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width);
  };

  const group =
    phase === "recording" || phase === "paused"
      ? "rec"
      : phase === "recorded"
        ? "play"
        : phase === "denied" || phase === "unavailable"
          ? "blocked"
          : "idle";
  const fade: Transition = reduced ? { duration: 0 } : { duration: 0.25, ease };
  const contentMotion = {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(4px)" },
    transition: fade,
  };

  return (
    // Left to right inside, like any player: the waveform and the timer read the same in a Hebrew page.
    <div dir="ltr" className={cn("inline-flex", className)}>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
      <motion.div
        layout
        transition={reduced ? { duration: 0 } : spring}
        className={cn(
          "relative flex items-center overflow-hidden border border-line bg-white text-ink-900 shadow-sm",
          group === "idle" ? "p-0" : "px-1.5",
        )}
        style={{ height: size, borderRadius: size / 2, minWidth: size }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {group === "idle" && (
            <motion.button
              key="idle"
              type="button"
              layout="position"
              {...contentMotion}
              onClick={() => void start()}
              disabled={phase === "requesting"}
              aria-label="התחלת הקלטה"
              title="התחלת הקלטה"
              whileTap={reduced ? undefined : { scale: 0.92 }}
              className="flex shrink-0 items-center gap-2 rounded-full px-4 font-medium text-ink-900 outline-none transition-colors hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-ink-500 disabled:cursor-wait"
              style={{ height: size - 2 }}
            >
              <motion.span
                className="grid place-items-center"
                animate={phase === "requesting" && !reduced ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                transition={phase === "requesting" ? { duration: 1.2, repeat: Infinity, ease: [0.76, 0, 0.24, 1] } : fade}
              >
                <Mic style={{ width: icon, height: icon }} aria-hidden />
              </motion.span>
              <span dir="rtl" className="text-sm">
                התחלת הקלטה
              </span>
            </motion.button>
          )}

          {group === "blocked" && (
            <motion.div key="blocked" layout="position" {...contentMotion} className="flex items-center gap-2 pr-1">
              <span className="grid shrink-0 place-items-center text-muted" style={{ width: inner, height: inner }}>
                <MicOff style={{ width: icon, height: icon }} aria-hidden />
              </span>
              <span dir="rtl" className="whitespace-nowrap text-xs text-muted">
                {phase === "denied" ? "אין גישה למיקרופון — אשרו בדפדפן" : "לא נמצא מיקרופון"}
              </span>
              <IconButton label="לנסות שוב" onClick={() => void start()} dim={inner} reduced={reduced}>
                <RotateCcw style={{ width: icon * 0.85, height: icon * 0.85 }} aria-hidden />
              </IconButton>
            </motion.div>
          )}

          {group === "rec" && (
            <motion.div key="rec" layout="position" {...contentMotion} className="flex items-center gap-1.5">
              <IconButton label="ביטול ההקלטה" onClick={() => finish(false)} dim={inner} reduced={reduced} className="hover:text-blocked">
                <Trash2 style={{ width: icon * 0.85, height: icon * 0.85 }} aria-hidden />
              </IconButton>
              <div className="flex items-center gap-2 pl-0.5">
                <motion.span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full bg-blocked"
                  animate={phase === "recording" && !reduced ? { opacity: [1, 0.3, 1] } : { opacity: phase === "recording" ? 1 : 0.35 }}
                  transition={phase === "recording" && !reduced ? { duration: 1.4, repeat: Infinity, ease: [0.76, 0, 0.24, 1] } : fade}
                />
                <span role="timer" aria-label={`זמן הקלטה ${fmt(elapsed)}`} className="min-w-9 text-xs font-semibold tabular-nums">
                  {fmt(elapsed)}
                </span>
              </div>
              <canvas ref={canvasRef} aria-hidden className="block text-ink-700" style={{ width: 140, height: Math.round(size * 0.5) }} />
              {phase === "recording" ? (
                <IconButton label="השהיה" onClick={pause} dim={inner} reduced={reduced}>
                  <Pause style={{ width: icon * 0.85, height: icon * 0.85 }} aria-hidden />
                </IconButton>
              ) : (
                <IconButton label="המשך הקלטה" onClick={resume} dim={inner} reduced={reduced}>
                  <Mic style={{ width: icon * 0.85, height: icon * 0.85 }} aria-hidden />
                </IconButton>
              )}
              {/* Finishing is the main action: the console's own primary button, labelled. */}
              <motion.button
                type="button"
                onClick={() => finish(true)}
                aria-label="סיום ההקלטה"
                title="סיום ההקלטה"
                whileTap={reduced ? undefined : { scale: 0.94 }}
                transition={spring}
                className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-ink-900 px-4 font-semibold text-champagne shadow-sm outline-none transition-colors hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-500 focus-visible:ring-offset-2"
                style={{ height: inner }}
              >
                <Check style={{ width: icon * 0.9, height: icon * 0.9 }} strokeWidth={3} aria-hidden />
                <span dir="rtl" className="text-sm">
                  סיום
                </span>
              </motion.button>
            </motion.div>
          )}

          {group === "play" && rec && (
            <motion.div key="play" layout="position" {...contentMotion} className="flex items-center gap-1.5">
              {rec.url && <audio ref={audioRef} src={rec.url} preload="metadata" onEnded={() => setPlaying(false)} className="hidden" />}
              <IconButton
                label={playing ? "השהיה" : "השמעת ההקלטה"}
                onClick={togglePlay}
                dim={inner}
                reduced={reduced}
                className="bg-ink-50 text-ink-900"
              >
                {playing ? (
                  <Pause style={{ width: icon * 0.8, height: icon * 0.8 }} fill="currentColor" aria-hidden />
                ) : (
                  <Play style={{ width: icon * 0.8, height: icon * 0.8 }} fill="currentColor" className="translate-x-px" aria-hidden />
                )}
              </IconButton>
              <div
                role="slider"
                tabIndex={0}
                aria-label="מיקום בהקלטה"
                aria-valuemin={0}
                aria-valuemax={Math.round(rec.duration / 1000)}
                aria-valuenow={posSec}
                aria-valuetext={`${fmt(posSec * 1000)} מתוך ${fmt(rec.duration)}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  seekFromPointer(e);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e);
                }}
                onKeyDown={(e) => {
                  const step = 0.05;
                  const p = progress.get();
                  if (e.key === "ArrowRight" || e.key === "ArrowUp") seek(p + step);
                  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") seek(p - step);
                  else if (e.key === "Home") seek(0);
                  else if (e.key === "End") seek(1);
                  else if (e.key === " " || e.key === "Enter") togglePlay();
                  else return;
                  e.preventDefault();
                }}
                className="relative flex cursor-pointer touch-none select-none items-center rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
                style={{ height: size * 0.6 }}
              >
                <Bars peaks={rec.peaks} height={size * 0.5} className="text-ink-300/60" />
                <motion.div className="absolute inset-y-0 left-1 flex items-center" style={{ clipPath: clip, color: accent }} aria-hidden>
                  <Bars peaks={rec.peaks} height={size * 0.5} />
                </motion.div>
              </div>
              <span className="min-w-9 text-right text-xs tabular-nums text-muted">
                {fmt(playing || posSec > 0 ? posSec * 1000 : rec.duration)}
              </span>
              <IconButton label="מחיקת ההקלטה" onClick={remove} dim={inner} reduced={reduced} className="hover:text-blocked">
                <Trash2 style={{ width: icon * 0.85, height: icon * 0.85 }} aria-hidden />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Bars({ peaks, height, className }: { peaks: number[]; height: number; className?: string }) {
  return (
    <div className={cn("flex items-center", className)} style={{ height, gap: BAR_GAP }} aria-hidden>
      {peaks.map((p, i) => (
        <span key={i} className="shrink-0 rounded-full bg-current" style={{ width: BAR, height: Math.max(BAR, p * height) }} />
      ))}
    </div>
  );
}

export default AiRecorder;

/* --- the saved recording ---------------------------------------------------- */

/** Bars across the player — enough that a long call still shows its shape. */
const PLAYER_PEAKS = 72;

/** The loudness of `blob` in `count` buckets, 0.12–1 — or null when the browser cannot decode it. */
async function peaksOf(blob: Blob, count: number): Promise<number[] | null> {
  try {
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    void ctx.close();
    const data = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / count));
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      let m = 0;
      for (let j = i * size; j < (i + 1) * size && j < data.length; j += 16) m = Math.max(m, Math.abs(data[j]));
      out.push(m);
    }
    const max = Math.max(...out, 0.02);
    return out.map((v) => clamp(0.12 + (v / max) * 0.88));
  } catch {
    return null;
  }
}

/**
 * A saved call's recording, drawn like the recorder's own playback: play, the
 * call's waveform filling as it plays (click or drag to jump), the time, and a
 * download of the file.
 */
export function RecordingPlayer({
  blob,
  filename,
  accent = "var(--color-ink-700)",
  size = 52,
}: {
  blob: Blob;
  filename: string;
  accent?: string;
  size?: number;
}) {
  const reduced = useReducedMotion() ?? false;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>(() => Array.from({ length: PLAYER_PEAKS }, () => 0.12));
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const progress = useMotionValue(0);
  const clip = useTransform(progress, (p) => `inset(0 ${(1 - p) * 100}% 0 0)`);
  const inner = Math.max(24, size - 12);
  const icon = Math.round(inner * 0.5);

  useEffect(() => {
    const made = URL.createObjectURL(blob);
    setUrl(made);
    void peaksOf(blob, PLAYER_PEAKS).then((p) => p && setPeaks(p));
    return () => URL.revokeObjectURL(made);
  }, [blob]);

  // While playing, follow the audio.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a && duration) {
        progress.set(clamp(a.currentTime / duration));
        setPos(a.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, progress]);

  const seek = (frac: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const f = clamp(frac);
    a.currentTime = f * duration;
    progress.set(f);
    setPos(f * duration);
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    if (progress.get() >= 0.999) seek(0);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width);
  };

  return (
    <div dir="ltr" className="flex w-full items-center gap-2 rounded-full border border-line bg-white px-1.5 text-ink-900 shadow-sm" style={{ height: size }}>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(e) => {
            // A recording made in the browser has no length written in it until it is read through.
            const a = e.currentTarget;
            if (Number.isFinite(a.duration)) setDuration(a.duration);
            else {
              a.currentTime = 1e9;
              a.ontimeupdate = () => {
                a.ontimeupdate = null;
                setDuration(a.duration);
                a.currentTime = 0;
              };
            }
          }}
          onEnded={() => {
            setPlaying(false);
            progress.set(1);
          }}
        />
      )}
      <IconButton
        label={playing ? "השהיה" : "השמעה"}
        onClick={toggle}
        dim={inner}
        reduced={reduced}
        className="bg-ink-900 hover:bg-ink-800"
        // Set directly: the button's own grey text class would otherwise win over a class here.
        style={{ color: "var(--color-champagne)" }}
      >
        {playing ? (
          <Pause style={{ width: icon * 0.8, height: icon * 0.8 }} fill="currentColor" aria-hidden />
        ) : (
          <Play style={{ width: icon * 0.8, height: icon * 0.8 }} fill="currentColor" className="translate-x-px" aria-hidden />
        )}
      </IconButton>
      <div
        role="slider"
        tabIndex={0}
        aria-label="מיקום בהקלטה"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${fmt(pos * 1000)} מתוך ${fmt(duration * 1000)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
        }}
        onKeyDown={(e) => {
          const p = progress.get();
          if (e.key === "ArrowRight") seek(p + 0.05);
          else if (e.key === "ArrowLeft") seek(p - 0.05);
          else if (e.key === " " || e.key === "Enter") toggle();
          else return;
          e.preventDefault();
        }}
        className="relative flex min-w-0 flex-1 cursor-pointer touch-none select-none items-center rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
        style={{ height: size * 0.6 }}
      >
        <WideBars peaks={peaks} height={size * 0.5} className="text-ink-300/60" />
        <motion.div className="absolute inset-y-0 left-1 right-1 flex items-center" style={{ clipPath: clip, color: accent }} aria-hidden>
          <WideBars peaks={peaks} height={size * 0.5} />
        </motion.div>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
        {fmt(pos * 1000)} / {duration ? fmt(duration * 1000) : "–:––"}
      </span>
      <a
        href={url ?? undefined}
        download={filename}
        aria-label="הורדת ההקלטה"
        title="הורדת ההקלטה"
        className="grid shrink-0 place-items-center rounded-full text-ink-700 outline-none transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-500"
        style={{ width: inner, height: inner }}
      >
        <Download style={{ width: icon * 0.85, height: icon * 0.85 }} aria-hidden />
      </a>
    </div>
  );
}

/** Bars spread across the whole width (the recorder's own `Bars` keep a fixed gap). */
function WideBars({ peaks, height, className }: { peaks: number[]; height: number; className?: string }) {
  return (
    <div className={cn("flex w-full items-center justify-between", className)} style={{ height }} aria-hidden>
      {peaks.map((p, i) => (
        <span key={i} className="shrink-0 rounded-full bg-current" style={{ width: BAR, height: Math.max(BAR, p * height) }} />
      ))}
    </div>
  );
}
