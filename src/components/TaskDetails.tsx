import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addTaskEvent, ApiError, deleteTaskFile, renameTaskFile, taskConversation, taskMediaPdfUrl, taskMediaUrl, updateTask, uploadTaskFile } from "../lib/api";
import type { Identity, Person, Task, TaskChatMessage, TaskPriority, TaskStatus } from "../types";
import { LuCalendarDays, LuCheck, LuChevronDown, LuDownload, LuExternalLink, LuFileText, LuMail, LuMessageCircle, LuPaperclip, LuPlus, LuSave, LuTrash2, LuX } from "react-icons/lu";
import { FileText, Pencil } from "lucide-react";
import { byMilo, COLUMNS, Modal, personName, PRIORITY, sourceLabel, sourceTone, taskTitle } from "./Tasks";
import { Button, confirmDialog, DateField, FIELD, openGoogle, Select, Tag, when } from "./ui";

/**
 * One task, opened: edit it, attach files, see the WhatsApp conversation behind
 * it, and open a mail or a meeting about it in the user's own Gmail / Google
 * Calendar, filled in — they send or save it there. Status, assignee and files
 * save at once; the title and description save on leaving the field, with
 * "שמירה", or on closing the task. Each change is noted in the task's history.
 */
export function TaskDetails({
  task,
  people,
  me,
  onChange,
  onClose,
}: {
  task: Task;
  people: Person[];
  me: Identity;
  onChange: (task: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title ?? "");
  const [description, setDescription] = useState(task.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  //: The history's latest HISTORY_LINES, or all of it.
  const [allHistory, setAllHistory] = useState(false);
  //: Closed until asked for, so opening a task does not load the whole chat.
  const [showChat, setShowChat] = useState(false);
  //: The moment the last save went through — "נשמר" shows for a few seconds after.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 3000);
    return () => window.clearTimeout(timer);
  }, [savedAt]);
  //: The file shown over the task, to look at and download.
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  //: The description grows with its text, so a long one is read whole, never scrolled in a box.
  const descriptionBox = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const box = descriptionBox.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight + 2}px`;
  }, [description]);
  //: The file whose name is being typed (its key), and the name so far.
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);

  /** Saves the typed name; a name typed without the extension keeps the file's own. */
  function rename(file: PreviewFile) {
    if (!renaming) return;
    const extension = file.name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "";
    let name = renaming.name.trim();
    setRenaming(null);
    if (!name || name === file.name) return;
    if (extension && !/\.[a-z0-9]{2,5}$/i.test(name)) name += extension;
    void save(() => renameTaskFile(task.id, file.key, name), "שינוי השם נכשל.");
  }

  //: What was typed but is not on the server yet.
  const changes: { title?: string; description?: string } = {};
  if (title.trim() && title.trim() !== (task.title ?? "")) changes.title = title.trim();
  if (description !== (task.description ?? "")) changes.description = description;
  const dirty = Object.keys(changes).length > 0;

  async function save(run: () => Promise<Task>, failure: string): Promise<boolean> {
    setBusy(true);
    try {
      onChange(await run());
      setError(null);
      setSavedAt(Date.now());
      return true;
    } catch (exc) {
      setError(exc instanceof ApiError || exc instanceof Error ? exc.message : failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Everything typed and not saved yet, in one go. */
  const saveAll = () => (dirty ? save(() => updateTask(task.id, changes), "השמירה נכשלה.") : Promise.resolve(true));

  /** Closing never drops what was typed: it is saved first, and the task stays open if that fails. */
  async function close() {
    if (await saveAll()) onClose();
  }

  /** A mail or a meeting about this task, filled in, in the user's own Google account. */
  function openInGoogle(kind: "email" | "meeting") {
    const subject = title.trim() || taskTitle(task);
    const details = [
      description.trim(),
      task.summary && task.summary !== subject ? task.summary : "",
      task.name || task.phone ? `לקוח: ${[task.name, task.phone].filter(Boolean).join(" · ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (kind === "email") openGoogle("mail", me.email);
    else openGoogle("calendar", me.email, { title: subject, details });
    // Opened, not necessarily sent: the history says so.
    void save(() => addTaskEvent(task.id, kind, kind === "email" ? "" : subject), "לא הצלחתי לרשום את זה במשימה.");
  }

  /** Only a file a user attached can be removed; what the client sent on WhatsApp stays with the conversation. */
  async function remove(file: PreviewFile) {
    if (!(await confirmDialog({ title: `למחוק את "${file.name}" מהמשימה?`, confirmLabel: "מחיקה", danger: true }))) return;
    void save(() => deleteTaskFile(task.id, file.key), "מחיקת הקובץ נכשלה.");
  }
  const attached = new Set(task.files.map((f) => f.key));

  /** Files on the task, and those the customer sent on WhatsApp — all attachable to a mail. */
  const files = [
    ...task.files.map((f) => previewFile(f.name, f.key)),
    ...task.messages
      .filter((m) => m.media_url)
      .map((m, i) => previewFile(m.media_name || `קובץ מהלקוח ${i + 1}`, m.media_url!)),
  ];

  return (
    <Modal onClose={() => void close()} size="xl">
      {/* A column the height of the panel, so the save bar sits at its bottom even on a short task. */}
      <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-white px-4 py-4 sm:px-6">
        <input
          value={title}
          placeholder={taskTitle(task)}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() =>
            title.trim() &&
            title !== (task.title ?? "") &&
            void save(() => updateTask(task.id, { title: title.trim() }), "שמירת הכותרת נכשלה.")
          }
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 font-display text-lg font-semibold text-ink-900 outline-none hover:border-line focus:border-ink-300"
        />
        <button onClick={() => void close()} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink-900" aria-label="סגירה">
          <LuX className="h-5 w-5" />
        </button>
      </div>

      {error && <p className="mx-4 mt-4 text-sm text-blocked sm:mx-6">{error}</p>}

      {/* Fits one screen: the side panel holds its fields two by two, the history shows its
          latest lines (all of them on request). */}
      <div className="grid flex-1 content-start gap-5 p-4 sm:px-6 sm:py-5 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {task.link_url && (
            <a
              href={task.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-milo px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              <LuExternalLink className="h-4 w-4" />
              {task.link_label || "פתח קישור"}
            </a>
          )}
          {task.summary && (
            <Section title="הסיכום של מילו">
              <p className="text-sm leading-relaxed text-ink-900">{task.summary}</p>
            </Section>
          )}

          <Section title="תיאור">
            <textarea
              ref={descriptionBox}
              rows={4}
              value={description}
              placeholder="הוסיפו תיאור…"
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (task.description ?? "") &&
                void save(() => updateTask(task.id, { description }), "שמירת התיאור נכשלה.")
              }
              className={`${FIELD} resize-none overflow-hidden leading-relaxed`}
            />
            {/* A text box can't hold a live link — e.g. the client's signing link. */}
            {description.match(/https?:\/\/[^\s]+/g)?.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="mt-1 block break-all text-xs text-ink-700 underline"
              >
                {url}
              </a>
            ))}
          </Section>

          <Section title="קבצים">
            <div className="flex flex-wrap gap-2">
              {files.map((file, i) =>
                renaming?.key === file.key ? (
                  <input
                    key={i}
                    autoFocus
                    value={renaming.name}
                    onChange={(e) => setRenaming({ key: file.key, name: e.target.value })}
                    onBlur={() => rename(file)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        // Cancels the name only, not the task behind it.
                        e.nativeEvent.stopPropagation();
                        setRenaming(null);
                      }
                    }}
                    aria-label="שם הקובץ"
                    className="h-[3.125rem] w-64 rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900 outline-none"
                  />
                ) : (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => dragFile(e, file)}
                    className="inline-flex max-w-full cursor-grab items-center rounded-xl border border-line bg-white transition hover:border-ink-300 hover:shadow-sm active:cursor-grabbing"
                  >
                    <button
                      type="button"
                      onClick={() => setPreview(file)}
                      title="לחיצה לתצוגה · גרירה לאתר או לתיקייה"
                      className="inline-flex min-w-0 items-center gap-2.5 py-1.5 pl-1 pr-1.5 text-right"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blocked/10 text-blocked">
                        <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[14rem] truncate text-sm font-medium text-ink-900">{file.name}</span>
                        <span className="block text-[0.75rem] text-muted">{dragAs(file).label}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRenaming({ key: file.key, name: file.name })}
                      className="ml-1.5 rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink-900"
                      aria-label={`שינוי השם של ${file.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {attached.has(file.key) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(file)}
                        className="ml-1.5 rounded-md p-1.5 text-muted hover:bg-blocked/10 hover:text-blocked"
                        aria-label={`מחיקת ${file.name}`}
                        title="מחיקה מהמשימה"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ),
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-ink-300 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50">
                <LuPlus className="h-4 w-4" />
                צירוף קובץ
                <input
                  type="file"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void save(() => uploadTaskFile(task.id, file), "העלאת הקובץ נכשלה.");
                  }}
                />
              </label>
            </div>
          </Section>

          {task.phone && task.kind && (
            <section>
              <button
                type="button"
                onClick={() => setShowChat(!showChat)}
                className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink-900"
              >
                השיחה עם מילו
                <LuChevronDown className={`h-4 w-4 transition-transform ${showChat ? "rotate-180" : ""}`} />
              </button>
              {showChat && <Conversation taskId={task.id} />}
            </section>
          )}

          <Section title="היסטוריה">
            <ul className="space-y-1.5">
              {[...task.events].reverse().slice(0, allHistory ? undefined : HISTORY_LINES).map((event, i) => (
                <li key={i} className="text-xs text-muted">
                  <span className="font-medium text-ink-900">{personName(people, event.by)}</span>{" "}
                  {describe(event, people)} · {when(event.at)}
                </li>
              ))}
              {(allHistory || task.events.length <= HISTORY_LINES) && (
                <li className="text-xs text-muted">
                  {byMilo(task) ? "מילו פתח את המשימה" : "המשימה נוצרה"} · {when(task.created_at)}
                </li>
              )}
            </ul>
            {task.events.length > HISTORY_LINES && (
              <button
                type="button"
                onClick={() => setAllHistory(!allHistory)}
                className="mt-1.5 text-xs font-semibold text-muted hover:text-ink-900"
              >
                {allHistory ? "פחות" : `כל ההיסטוריה (${task.events.length + 1})`}
              </button>
            )}
          </Section>
        </div>

        <aside className="grid grid-cols-2 content-start gap-3 md:sticky md:top-24 md:self-start">
          <Field label="סטטוס">
            <Select<TaskStatus>
              value={task.status}
              disabled={busy}
              onChange={(status) => void save(() => updateTask(task.id, { status }), "שינוי הסטטוס נכשל.")}
              options={COLUMNS.map((c) => ({ value: c.status, label: c.label }))}
            />
          </Field>
          <Field label="אחראי/ת">
            <Select
              value={task.assignee ?? ""}
              disabled={busy}
              onChange={(assignee) => void save(() => updateTask(task.id, { assignee }), "השיוך נכשל.")}
              options={[
                { value: "", label: "ללא שיוך" },
                ...people.map((p) => ({ value: p.email, label: p.display_name || p.email })),
              ]}
            />
          </Field>
          <Field label="תאריך יעד">
            <DateField
              value={task.due_date ?? ""}
              placeholder="ללא תאריך"
              onChange={(due_date) => void save(() => updateTask(task.id, { due_date }), "קביעת התאריך נכשלה.")}
            />
            {task.due_date && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(() => updateTask(task.id, { due_date: "" }), "הסרת התאריך נכשלה.")}
                className="mt-1 text-xs font-semibold text-muted hover:text-ink-900"
              >
                הסרת התאריך
              </button>
            )}
          </Field>
          <Field label="עדיפות">
            <Select<TaskPriority>
              value={task.priority ?? "normal"}
              disabled={busy}
              onChange={(priority) => void save(() => updateTask(task.id, { priority }), "שינוי העדיפות נכשל.")}
              options={(Object.keys(PRIORITY) as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY[p].label }))}
            />
          </Field>
          <Field label="מקור">
            <Tag tone={sourceTone(task)}>{sourceLabel(task)}</Tag>
          </Field>
          {(task.name || task.phone) && (
            <Field label="לקוח" wide>
              <p className="text-sm text-ink-900">{task.name}</p>
              {task.phone && (
                <>
                  <p className="text-xs text-muted">
                    <span dir="ltr">{task.phone}</span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 w-full"
                    onClick={() => window.open(`https://wa.me/${task.phone!.replace(/\D/g, "")}`, "_blank", "noopener")}
                  >
                    <LuMessageCircle className="h-4 w-4" />
                    לדבר עם הלקוח בוואטסאפ
                  </Button>
                </>
              )}
            </Field>
          )}
          <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Button variant="ghost" size="sm" onClick={() => openInGoogle("email")}>
              <LuMail className="h-4 w-4" />
              שליחת מייל
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openInGoogle("meeting")}>
              <LuCalendarDays className="h-4 w-4" />
              קביעת פגישה
            </Button>
          </div>
        </aside>
      </div>

      {/* Always in view at the bottom of the task. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-line bg-white px-4 py-3 sm:px-6">
        {/* Keeps the field focused on press, so leaving it does not save the same text a second time. */}
        <span onMouseDown={(e) => e.preventDefault()}>
          <Button onClick={() => void saveAll()} disabled={busy || !dirty}>
            <LuSave className="h-4 w-4" />
            שמירה
          </Button>
        </span>
        <span className={`flex items-center gap-1.5 text-sm ${dirty ? "font-semibold text-attention" : "text-muted"}`}>
          {busy ? (
            "שומר…"
          ) : dirty ? (
            "יש שינויים שלא נשמרו"
          ) : savedAt ? (
            <>
              <LuCheck className="h-4 w-4 text-ink-700" /> נשמר
            </>
          ) : (
            "כל השינויים שמורים"
          )}
        </span>
      </div>
      </div>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </Modal>
  );
}

/** A file to show: its name, its key on the task, where to read it, and where to read it as a PDF. */
/** A file to look at: on the server (`key`, `pdf`), or one picked but not uploaded yet
    (`url` a blob: URL, `pdf` empty — there is nothing on the server to convert). */
export type PreviewFile = { name: string; key: string; url: string; pdf: string };
const previewFile = (name: string, key: string): PreviewFile => ({ name, key, url: taskMediaUrl(key), pdf: taskMediaPdfUrl(key) });

/** How many lines of a task's history show before "כל ההיסטוריה". */
const HISTORY_LINES = 4;

/** Extensions the server turns into a PDF (see the API's files_pdf). */
const PDF_ABLE = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

/**
 * How a file leaves the console when dragged: a PDF or a picture as a PDF, anything
 * else as it is. WhatsApp files have no extension, and are pictures or PDFs.
 */
export function dragAs(file: PreviewFile): { name: string; url: string; type: string; label: string } {
  const extension = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1].toLowerCase();
  if (!extension || PDF_ABLE.includes(extension))
    return { name: `${file.name.replace(/\.[a-z0-9]{2,5}$/i, "")}.pdf`, url: file.pdf, type: "application/pdf", label: "PDF" };
  return { name: file.name, url: file.url, type: "application/octet-stream", label: extension.toUpperCase() };
}

/**
 * Drag a file out of the console, as in WhatsApp Web: Chrome / Edge download it
 * where it is dropped (`DownloadURL`), with the session cookie, like any download.
 */
function dragFile(e: DragEvent, file: PreviewFile) {
  const { name, url, type } = dragAs(file);
  e.dataTransfer.effectAllowed = "copy";
  // `type:name:url` — a colon in the name would break it.
  e.dataTransfer.setData("DownloadURL", `${type}:${name.replace(/:/g, "-")}:${new URL(url, location.href).href}`);
}

/** iPhone photos: no browser on Windows shows them, so they are shown as the PDF the server makes. */
const isHeic = (type: string) => type === "image/heic" || type === "image/heif";

/** What a file's type is saved as, when its name has no extension (WhatsApp files have none). */
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

/**
 * A file over the task: a picture or a PDF shown in place, anything else with
 * just the download. Read once, behind the console's sign-in, and kept in memory
 * while it is open, so downloading does not fetch it again.
 */
export function FilePreview({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  const [blob, setBlob] = useState<{ url: string; type: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(file.url, { credentials: "include" })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setBlob({ url: objectUrl, type: data.type });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.url]);

  // Escape closes the preview only, not the task behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const extension = blob && EXTENSIONS[blob.type];
  const filename = extension && !/\.[a-z0-9]{2,5}$/i.test(file.name) ? `${file.name}.${extension}` : file.name;
  //: A picture can also be downloaded as a PDF; a PDF already is one, and other files cannot be turned into one.
  const convertible = !!blob && blob.type.startsWith("image/");
  const pdfName = `${filename.replace(/\.[a-z0-9]{2,5}$/i, "")}.pdf`;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/60 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{file.name}</p>
          {blob && (
            <a
              href={blob.url}
              download={filename}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-champagne hover:bg-ink-800"
            >
              <LuDownload className="h-4 w-4" />
              הורדה
            </a>
          )}
          {convertible && file.pdf && (
            <a
              href={file.pdf}
              download={pdfName}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-900 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-paper"
            >
              <LuFileText className="h-4 w-4" />
              הורדה כ-PDF
            </a>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink-900" aria-label="סגירה">
            <LuX className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-paper">
          {failed ? (
            <p className="text-sm text-blocked">הקובץ לא זמין.</p>
          ) : !blob ? (
            <p className="text-sm text-muted">טוען…</p>
          ) : isHeic(blob.type) ? (
            <iframe src={file.pdf} title={file.name} className="h-full w-full" />
          ) : blob.type.startsWith("image/") ? (
            <img src={blob.url} alt={file.name} className="max-h-full max-w-full object-contain" />
          ) : blob.type === "application/pdf" ? (
            <iframe src={blob.url} title={file.name} className="h-full w-full" />
          ) : (
            <p className="text-sm text-muted">אין תצוגה מקדימה.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function describe(event: Task["events"][number], people: Person[]): string {
  switch (event.type) {
    case "created":
      return "יצר/ה את המשימה";
    case "status":
      return `העביר/ה ל"${COLUMNS.find((c) => c.status === event.text)?.label ?? event.text}"`;
    case "assignee":
      return event.text ? `שייך/ה ל${personName(people, event.text)}` : "הסיר/ה את השיוך";
    case "file":
      return `צירף/ה את ${event.text}`;
    case "file_rename":
      return `שינה/תה שם של קובץ: ${event.text}`;
    case "file_delete":
      return `מחק/ה את ${event.text}`;
    case "due":
      return event.text ? `קבע/ה תאריך יעד: ${dueLabel(event.text)}` : "הסיר/ה את תאריך היעד";
    case "priority":
      return `שינה/תה עדיפות ל"${PRIORITY[(event.text ?? "normal") as TaskPriority]?.label ?? event.text}"`;
    case "email":
      return event.text ? `פתח/ה מייל ב-Gmail: ${event.text}` : "פתח/ה מייל ב-Gmail";
    case "meeting":
      return `פתח/ה פגישה ביומן: ${event.text}`;
    case "polywizz":
      return event.text ?? "עדכון מ-PolyWizz";
  }
}

/** "יום ב׳, 30 בנוב׳" — a task's due day as the console shows it. */
export function dueLabel(date: string): string {
  return new Date(`${date}T00:00`).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <p className="mb-1 text-xs font-semibold text-muted">{label}</p>
      {children}
    </div>
  );
}

/** The WhatsApp chat behind a task: the customer on the right, Milo on the left. */
function Conversation({ taskId }: { taskId: string }) {
  const [chat, setChat] = useState<TaskChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    taskConversation(taskId)
      .then(setChat)
      .catch((exc) => setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את השיחה."));
  }, [taskId]);

  if (error) return <p className="mt-3 text-sm text-blocked">{error}</p>;
  if (!chat) return <p className="mt-3 text-sm text-muted">טוען את השיחה…</p>;
  if (!chat.length) return <p className="mt-3 text-sm text-muted">אין הודעות שמורות לשיחה הזו.</p>;

  return <ChatBubbles chat={chat} />;
}

/** WhatsApp-style bubbles — here, and in "שאל את מילו" when he shows a conversation. */
export function ChatBubbles({ chat }: { chat: TaskChatMessage[] }) {
  const bottom = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [chat]);

  return (
    <div className="mt-3 max-h-[30rem] space-y-2 overflow-y-auto rounded-xl bg-[#efeae2] p-4">
      {chat.map((message, i) => {
        const milo = message.role === "milo";
        return (
          <div key={i} className={`flex ${milo ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${milo ? "bg-white" : "bg-[#d9fdd3]"}`}
            >
              <p className={`text-xs font-semibold ${milo ? "text-[#1f7aec]" : "text-[#008069]"}`}>
                {milo ? "מילו" : "הלקוח"}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">{message.text}</p>
              {message.media_url && (
                <button
                  type="button"
                  onClick={() => setPreview(previewFile("קובץ מהלקוח", message.media_url!))}
                  className="inline-flex items-center gap-1 text-xs text-[#1f7aec] underline underline-offset-2"
                >
                  <LuPaperclip className="h-3.5 w-3.5" />
                  קובץ
                </button>
              )}
              <p className="mt-1 text-left text-[0.75rem] text-muted">{when(message.at)}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottom} />
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
