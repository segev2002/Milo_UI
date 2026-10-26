import { useCallback, useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from "react";

/** The robot's height on the welcome screen. */
const HEIGHT = 260;
/** How much of the video's height the robot itself fills. */
const ROBOT = 0.9;
/** Where he lands: the logo at the top of the sidebar. */
const TARGET = 'aside img[alt="מילו"]';

/** The robot without a background. Safari plays transparency only in HEVC,
    everyone else in WebM (VP9). */
const SOURCE = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent)
  ? "/milo-intro.mov"
  : "/milo-intro.webm";

type Phase = "enter" | "play" | "fly";

/**
 * Right after a Google sign-in: a welcome screen in the console's design, and
 * Milo waking up and waving over it. Then the screen fades into the console
 * and Milo flies into the sidebar's logo. A click or Escape skips ahead.
 */
export function Intro({ name, onDone }: { name: string; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const flying = useRef(false);
  const [phase, setPhase] = useState<Phase>("enter");
  const [flight, setFlight] = useState<CSSProperties>({});

  /** Move the robot onto the logo; with no logo on screen, just fade out. */
  const fly = useCallback(() => {
    if (flying.current) return;
    flying.current = true;
    const rect = document.querySelector<HTMLElement>(TARGET)?.getBoundingClientRect();
    const visible = rect && rect.width > 0 && rect.left >= 0 && rect.right <= window.innerWidth;
    if (!visible) {
      setFlight({ opacity: 0 });
    } else {
      const dx = rect.left + rect.width / 2 - window.innerWidth / 2;
      const dy = rect.top + rect.height / 2 - window.innerHeight / 2;
      setFlight({ transform: `translate(${dx}px, ${dy}px) scale(${rect.height / (HEIGHT * ROBOT)})` });
    }
    setPhase("fly");
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    // The logo appears only when Milo lands on it.
    const logo = document.querySelector<HTMLElement>(TARGET);
    if (logo) logo.style.visibility = "hidden";
    const player = video.current;
    // With sound when the browser allows it — the sign-in click usually
    // counts — and muted when it does not.
    player?.play().catch(() => {
      player.muted = true;
      player.play().catch(fly);
    });
    const enter = requestAnimationFrame(() => setPhase("play"));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fly();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(enter);
      window.removeEventListener("keydown", onKey);
      if (logo) logo.style.visibility = "";
    };
  }, [onDone, fly]);

  /** The robot reached the logo (or faded out): hand over to the console. */
  const landed = (e: TransitionEvent) => {
    if (phase === "fly" && e.target === e.currentTarget) onDone();
  };

  const first = name.split(" ")[0];
  const shown = phase === "play";

  return (
    <div className="fixed inset-0 z-[100]" onClick={fly}>
      {/* The welcome screen: the console's own backdrop, fading out as Milo leaves. */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ background: "var(--backdrop, var(--color-paper))", opacity: phase === "fly" ? 0 : 1 }}
      >
        <div
          className="absolute inset-x-0 text-center transition-all duration-500"
          style={{
            top: `calc(50% + ${HEIGHT / 2 + 12}px)`,
            opacity: shown ? 1 : 0,
            transform: shown ? "none" : "translateY(8px)",
          }}
        >
          <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
            ברוכים הבאים, {first}
          </h1>
          <p className="mt-2 text-sm text-muted">מילו מכין לך את היום</p>
        </div>
      </div>

      {/* Milo, centred above the greeting. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <video
          ref={video}
          src={SOURCE}
          playsInline
          preload="auto"
          onEnded={fly}
          onError={fly}
          onTransitionEnd={landed}
          className="pointer-events-auto cursor-pointer"
          style={{
            height: HEIGHT,
            transition:
              phase === "fly"
                ? "transform 0.9s cubic-bezier(0.6, 0, 0.2, 1), opacity 0.5s ease"
                : "transform 0.45s cubic-bezier(0.3, 1.4, 0.5, 1), opacity 0.3s ease",
            ...(phase === "enter" ? { opacity: 0, transform: "scale(0.6)" } : phase === "play" ? {} : flight),
          }}
        />
      </div>
    </div>
  );
}
