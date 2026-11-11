import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LuCheck, LuCopy, LuRefreshCw, LuRotateCcw, LuSearch, LuSend, LuTrash2, LuUpload, LuX } from "react-icons/lu";
import { ApiError, callAudio, deleteCall, getCall, listCalls, retryCall, uploadCall } from "../lib/api";
import { useCached } from "../lib/cache";
import type { CallStatus, CallTranscription } from "../types";
import { AiRecorder, RecordingPlayer } from "./AiRecorder";
import { Modal } from "./Tasks";
import { Button, Card, Empty, FIELD, Select, Tag, Typing } from "./ui";

/**
 * תמלול שיחות. Sigal's calls are on her phone; the console records them through
 * the computer's microphone, with the phone on speaker beside it. When the call
 * ends the recording goes to Milo, who transcribes all of it first and only then
 * writes the summary. The recording is kept too, in a folder per client. One card
 * per call — search them by name, ID or phone; open one for the summary, the
 * whole transcript and the recording.
 */

const STATUS: Record<CallStatus, { label: string; tone: "neutral" | "warm" | "ink" | "milo" | "claim" }> = {
  transcribing: { label: "מתמלל…", tone: "warm" },
  summarizing: { label: "מסכם…", tone: "milo" },
  done: { label: "מוכן", tone: "ink" },
  failed: { label: "נכשל", tone: "claim" },
};
const working = (c: CallTranscription) => c.status === "transcribing" || c.status === "summarizing";
/** How often a call still being worked on is checked. */
const POLL_MS = 5_000;
/** Speech, small: about 14MB an hour. */
const BITRATE = 32_000;
const MIC_KEY = "milo.calls.mic";

const message = (exc: unknown, fallback: string) => (exc instanceof ApiError ? exc.message : fallback);

function clock(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The downloaded file's name: the client, the date, and the recording's own type. */
function recordingName(call: CallTranscription, audio: Blob): string {
  const t = audio.type;
  const ext = t.includes("mp4") || t.includes("m4a") ? "m4a" : t.includes("mpeg") ? "mp3" : t.includes("ogg") ? "ogg" : "webm";
  return `${[call.client_name, call.id_number].filter(Boolean).join(" - ")} ${call.created_at.slice(0, 10)}.${ext}`;
}

/** Digits only, so "052-674 7180" finds 0526747180. */
const digits = (s: string) => s.replace(/\D/g, "");

function matches(c: CallTranscription, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (c.client_name.toLowerCase().includes(q)) return true;
  const d = digits(q);
  return !!d && [c.phone, c.id_number].some((v) => v && digits(v).includes(d));
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function Calls() {
  const [calls, setCalls] = useCached<CallTranscription[] | null>("calls.list", null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useCached("calls.query", "");

  const refresh = useCallback(async () => {
    try {
      setCalls(await listCalls());
      setError(null);
    } catch (exc) {
      setError(message(exc, "לא הצלחתי לטעון את השיחות."));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  //: While Milo is still working on a call, its card follows along.
  const busy = calls?.some(working) ?? false;
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);

  const added = (call: CallTranscription) => setCalls((prev) => [call, ...(prev ?? [])]);
  const shown = (calls ?? []).filter((c) => matches(c, query));

  async function remove(id: string) {
    try {
      await deleteCall(id);
      setCalls((prev) => prev?.filter((c) => c.id !== id) ?? null);
      setError(null);
    } catch (exc) {
      setError(message(exc, "המחיקה נכשלה."));
    }
  }

  return (
    <div className="space-y-5">
      <Recorder onUploaded={added} onError={setError} />

      {error && (
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold text-ink-900">שיחות</h2>
        <label className="relative w-full max-w-xs">
          <LuSearch className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, ת.ז או טלפון"
            aria-label="חיפוש שיחות"
            className={`${FIELD} py-2 pr-9 text-sm`}
          />
        </label>
        <button
          onClick={() => void refresh()}
          title="רענון"
          aria-label="רענון"
          className="mr-auto rounded-lg border border-line bg-white p-2 text-ink-700 transition-colors hover:bg-paper"
        >
          <LuRefreshCw className="h-4 w-4" />
        </button>
      </div>

      {calls === null ? (
        <p className="px-5 py-12 text-center text-sm text-muted">טוען…</p>
      ) : calls.length === 0 ? (
        <Card>
          <Empty title="אין עדיין שיחות" />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <Empty title="לא נמצאו שיחות" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <CallCard key={c.id} call={c} onOpen={() => setOpenId(c.id)} onDelete={() => remove(c.id)} />
          ))}
        </div>
      )}

      {openId && (
        <CallDetails
          id={openId}
          onClose={() => setOpenId(null)}
          onChange={(call) => setCalls((prev) => prev?.map((c) => (c.id === call.id ? { ...c, ...call } : c)) ?? null)}
        />
      )}
    </div>
  );
}

/** One call: open it with a click; delete it from here, with a second click to confirm. */
function CallCard({ call: c, onOpen, onDelete }: { call: CallTranscription; onOpen: () => void; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="flex flex-col rounded-xl border border-line bg-white shadow-sm transition-colors hover:border-ink-300">
      <button onClick={onOpen} className="block w-full flex-1 px-4 pb-3 pt-4 text-right">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-base font-semibold text-ink-900">{c.client_name}</p>
          <Tag tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Tag>
        </div>
        {(c.phone || c.id_number) && (
          <p className="mt-1 truncate text-right text-xs text-muted">
            {[c.phone, c.id_number].filter(Boolean).map((v) => (
              <span key={v} dir="ltr" className="ml-3 inline-block">
                {v}
              </span>
            ))}
          </p>
        )}
      </button>
      {/* The footer: when and how long — or, after the trash, the question. */}
      <div className="flex min-h-11 items-center justify-between gap-2 border-t border-line px-4 py-1.5 text-xs">
        {confirming ? (
          <>
            <span className="font-semibold text-blocked">למחוק את השיחה וההקלטה?</span>
            <span className="flex gap-1.5">
              <button
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  void onDelete().finally(() => setDeleting(false));
                }}
                className="rounded-md bg-blocked px-2.5 py-1 font-semibold text-white disabled:opacity-60"
              >
                מחיקה
              </button>
              <button onClick={() => setConfirming(false)} className="rounded-md border border-line bg-white px-2.5 py-1 text-ink-900">
                ביטול
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-3 text-muted">
              <span>{dateTime(c.created_at)}</span>
              {c.duration_seconds ? <span dir="ltr">{clock(c.duration_seconds)}</span> : null}
            </span>
            <button
              onClick={() => setConfirming(true)}
              aria-label={`מחיקת השיחה עם ${c.client_name}`}
              title="מחיקה"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[#fbeceb] hover:text-blocked"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* --- recording ------------------------------------------------------------ */

function Recorder({ onUploaded, onError }: { onUploaded: (call: CallTranscription) => void; onError: (e: string | null) => void }) {
  const [client, setClient] = useState({ client_name: "", phone: "", id_number: "" });
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [mic, setMic] = useState(() => {
    try {
      return localStorage.getItem(MIC_KEY) ?? "";
    } catch {
      return "";
    }
  });
  //: A finished recording (or a picked file) not sent yet. Kept in this page only.
  const [pending, setPending] = useState<{ audio: Blob; filename: string; ms: number } | null>(null);
  //: The details form: who the call was with.
  const [asking, setAsking] = useState(false);
  //: Which of the two sends was chosen: with the recording kept, or only its text.
  const [keepAudio, setKeepAudio] = useState(true);
  const ask = (keep: boolean) => {
    setKeepAudio(keep);
    setAsking(true);
  };
  const [uploading, setUploading] = useState(false);
  //: A new key starts the recorder over, empty — after a recording was sent.
  const [round, setRound] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadMics = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter((d) => d.kind === "audioinput" && d.deviceId));
    } catch {
      setMics([]);
    }
  }, []);
  useEffect(() => {
    void loadMics();
  }, [loadMics]);

  //: Closing the tab before the recording was sent would lose it.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const pickMic = (id: string) => {
    setMic(id);
    try {
      localStorage.setItem(MIC_KEY, id);
    } catch {
      // Storage blocked: it just isn't remembered.
    }
  };

  async function send() {
    if (!pending || !client.client_name.trim()) return;
    setAsking(false);
    setUploading(true);
    try {
      onUploaded(
        await uploadCall(pending.audio, pending.filename, {
          client_name: client.client_name.trim(),
          phone: client.phone.trim(),
          id_number: client.id_number.trim(),
        }, keepAudio),
      );
      setClient({ client_name: "", phone: "", id_number: "" });
      setPending(null);
      setRound((n) => n + 1);
      onError(null);
    } catch (exc) {
      // The recording stays, with the details, to send again.
      onError(message(exc, "שליחת ההקלטה נכשלה."));
    } finally {
      setUploading(false);
    }
  }

  function upload(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setPending({ audio: file, filename: file.name, ms: 0 });
  }

  const field = (
    key: keyof typeof client,
    label: string,
    props: { dir?: "ltr"; inputMode?: "tel" | "numeric" } = {},
    first = false,
  ) => (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-ink-900">{label}</span>
      <input
        autoFocus={first}
        required={first}
        value={client[key]}
        onChange={(e) => setClient({ ...client, [key]: e.target.value })}
        className={FIELD}
        {...props}
      />
    </label>
  );

  const picked = pending && pending.ms === 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        {picked ? (
          // A file from the computer: its name, and a way to drop it.
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink-900">
            {pending.filename}
            <button onClick={() => setPending(null)} aria-label="הסרת הקובץ" className="text-muted hover:text-blocked">
              <LuTrash2 className="h-4 w-4" />
            </button>
          </span>
        ) : (
          <AiRecorder
            key={round}
            size={52}
            bitrate={BITRATE}
            deviceId={mic}
            onPermission={() => void loadMics()}
            onRecordingComplete={(audio, ms) => {
              setPending({ audio, filename: `call-${new Date().toISOString().slice(0, 16)}.webm`, ms });
              onError(null);
            }}
            onDelete={() => setPending(null)}
          />
        )}
        {pending && !uploading && (
          <>
            <Button onClick={() => ask(true)}>
              <LuSend className="h-4 w-4" />
              שליחה למילו עם ההקלטה
            </Button>
            <Button variant="ghost" onClick={() => ask(false)}>
              <LuSend className="h-4 w-4" />
              שליחה למילו בלי ההקלטה
            </Button>
          </>
        )}
        {uploading && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Typing /> שולח את ההקלטה…
          </span>
        )}
        {!pending && (
          <>
            <Button variant="ghost" onClick={() => fileInput.current?.click()}>
              <LuUpload className="h-4 w-4" />
              העלאת הקלטה
            </Button>
            <input ref={fileInput} type="file" accept="audio/*,video/webm" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </>
        )}
        {mics.length > 1 && !pending && (
          <div className="w-56">
            <Select
              value={mic}
              onChange={pickMic}
              options={[{ value: "", label: "מיקרופון ברירת מחדל" }, ...mics.map((m, i) => ({ value: m.deviceId, label: m.label || `מיקרופון ${i + 1}` }))]}
              className="py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {asking && pending && (
        <Modal onClose={() => setAsking(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="space-y-5 p-5 sm:p-8"
          >
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink-900">עם מי הייתה השיחה?</h2>
              <p className="mt-1 text-sm text-muted">
                {pending.ms > 0 && (
                  <>
                    הקלטה של <span dir="ltr">{clock(pending.ms / 1000)}</span> ·{" "}
                  </>
                )}
                {keepAudio ? "ההקלטה תישמר בתיקייה של הלקוח" : "ההקלטה לא תישמר — רק התמלול והסיכום"}
              </p>
            </div>
            <div className="space-y-4">
              {field("client_name", "שם הלקוח", {}, true)}
              <div className="grid gap-4 sm:grid-cols-2">
                {field("phone", "טלפון (לא חובה)", { dir: "ltr", inputMode: "tel" })}
                {field("id_number", "ת.ז (לא חובה)", { dir: "ltr", inputMode: "numeric" })}
              </div>
            </div>
            <div className="flex gap-2 border-t border-line pt-5">
              <Button type="submit" disabled={!client.client_name.trim()}>
                {keepAudio ? "שליחה למילו עם ההקלטה" : "שליחה למילו בלי ההקלטה"}
              </Button>
              <Button variant="ghost" onClick={() => setAsking(false)}>
                אחר כך
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

/* --- one call ------------------------------------------------------------- */

function CallDetails({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange: (call: CallTranscription) => void;
}) {
  const [call, setCall] = useState<CallTranscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const hasAudio = !!call?.audio_key;

  const load = useCallback(async () => {
    try {
      const fresh = await getCall(id);
      setCall(fresh);
      onChange(fresh);
    } catch (exc) {
      setError(message(exc, "לא הצלחתי לטעון את השיחה."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!call || !working(call)) return;
    const timer = window.setTimeout(() => void load(), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [call, load]);

  //: The recording, fetched once the call says it has one.
  useEffect(() => {
    if (!hasAudio) return;
    callAudio(id)
      .then(setAudio)
      .catch(() => setError("ההקלטה לא זמינה."));
  }, [id, hasAudio]);

  async function retry() {
    try {
      const fresh = await retryCall(id);
      setCall(fresh);
      onChange(fresh);
      setError(null);
    } catch (exc) {
      setError(message(exc, "לא הצלחתי להתחיל מחדש."));
    }
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="space-y-5 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-900">{call?.client_name ?? "…"}</h2>
            {call && (
              // Each piece on its own, so a time and a length never run into each other.
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                {[
                  dateTime(call.created_at),
                  call.duration_seconds ? `משך ${clock(call.duration_seconds)}` : null,
                  call.phone,
                  call.id_number ? `ת.ז ${call.id_number}` : null,
                ]
                  .filter((v): v is string => !!v)
                  .map((v, i) => (
                    <span key={v} className="flex items-center gap-2">
                      {i > 0 && <span aria-hidden>·</span>}
                      <bdi>{v}</bdi>
                    </span>
                  ))}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {call && <Tag tone={STATUS[call.status].tone}>{STATUS[call.status].label}</Tag>}
            <button
              onClick={onClose}
              aria-label="סגירה"
              title="סגירה"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink-900"
            >
              <LuX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-blocked">{error}</p>}

        {hasAudio && (
          <Section title="ההקלטה">
            {audio ? (
              <RecordingPlayer blob={audio} filename={recordingName(call!, audio)} />
            ) : (
              <p className="text-sm text-muted">טוען את ההקלטה…</p>
            )}
          </Section>
        )}

        {call?.status === "failed" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-sm text-blocked">
            <span>{call.error || "העיבוד נכשל."}</span>
            {hasAudio ? (
              <Button size="sm" variant="ghost" onClick={() => void retry()}>
                <LuRotateCcw className="h-3.5 w-3.5" />
                לנסות שוב
              </Button>
            ) : (
              <span>אין הקלטה שמורה, אז צריך להקליט את השיחה מחדש.</span>
            )}
          </div>
        )}

        <Section title="סיכום" copy={call?.summary && plainText(call.summary)}>
          {call?.summary ? (
            <Markdown text={call.summary} />
          ) : call && working(call) ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Typing /> {call.status === "transcribing" ? "מילו מתמלל…" : "מילו כותב את הסיכום…"}
            </p>
          ) : (
            <p className="text-sm text-muted">אין סיכום.</p>
          )}
        </Section>

        <Section title="תמלול מלא" copy={call?.transcript}>
          {call?.transcript ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{call.transcript}</p>
          ) : (
            <p className="text-sm text-muted">{call && working(call) ? "בתמלול…" : "אין תמלול."}</p>
          )}
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, copy, children }: { title: string; copy?: string | null; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <section className="rounded-xl border border-line bg-paper/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-900">{title}</h3>
        {copy && (
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(copy).then(() => setCopied(true))}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-paper hover:text-ink-900"
          >
            {copied ? <LuCheck className="h-3.5 w-3.5" /> : <LuCopy className="h-3.5 w-3.5" />}
            {copied ? "הועתק" : "העתקה"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** The summary without its Markdown marks, to paste into a mail or WhatsApp. */
const plainText = (markdown: string) => markdown.replace(/\*\*/g, "").replace(/^\s*#{1,4}\s+/gm, "");

/** The summary's Markdown: headings, bullets, bold. That is all Milo writes in it. */
function Markdown({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-body">
      {text.split("\n").map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        const heading = line.match(/^#{1,4}\s+(.*)$/);
        if (heading)
          return (
            <h4 key={i} className="pt-2 text-[15px] font-bold text-ink-900 first:pt-0">
              {inline(heading[1])}
            </h4>
          );
        const bullet = line.match(/^[-*•]\s+(.*)$/);
        if (bullet)
          return (
            <p key={i} className="flex gap-2 pr-1">
              <span className="text-ink-500">•</span>
              <span>{inline(bullet[1])}</span>
            </p>
          );
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}
