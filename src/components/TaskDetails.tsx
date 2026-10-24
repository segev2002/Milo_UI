import { useEffect, useRef, useState, type ReactNode } from "react";
import { addTaskEvent, ApiError, taskConversation, taskMediaUrl, updateTask, uploadTaskFile } from "../lib/api";
import type { Identity, Person, Task, TaskChatMessage, TaskStatus } from "../types";
import { LuCalendarDays, LuChevronDown, LuExternalLink, LuMail, LuMessageCircle, LuPaperclip, LuPlus, LuX } from "react-icons/lu";
import { COLUMNS, Modal, personName, sourceLabel, sourceTone, taskTitle } from "./Tasks";
import { Button, FIELD, openGoogle, Select, Tag, when } from "./ui";

/**
 * One task, opened: edit it, attach files, see the WhatsApp conversation behind
 * it, and open a mail or a meeting about it in the user's own Gmail / Google
 * Calendar, filled in — they send or save it there. Every change is saved as it
 * is made, and noted in the task's history by the server.
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
  //: Closed until asked for, so opening a task does not load the whole chat.
  const [showChat, setShowChat] = useState(false);

  async function save(run: () => Promise<Task>, failure: string) {
    setBusy(true);
    try {
      onChange(await run());
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError || exc instanceof Error ? exc.message : failure);
    }
    setBusy(false);
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

  /** Files on the task, and those the customer sent on WhatsApp — all attachable to a mail. */
  const files = [
    ...task.files.map((f) => ({ name: f.name, url: taskMediaUrl(f.key) })),
    ...task.messages
      .filter((m) => m.media_url)
      .map((m, i) => ({ name: `קובץ מהלקוח ${i + 1}`, url: taskMediaUrl(m.media_url!) })),
  ];

  return (
    <Modal onClose={onClose} size="xl">
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
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink-900" aria-label="סגירה">
          <LuX className="h-5 w-5" />
        </button>
      </div>

      {error && <p className="mx-4 mt-4 text-sm text-blocked sm:mx-6">{error}</p>}

      <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[1fr_240px]">
        <div className="min-w-0 space-y-6">
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
              rows={4}
              value={description}
              placeholder="הוסיפו תיאור…"
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (task.description ?? "") &&
                void save(() => updateTask(task.id, { description }), "שמירת התיאור נכשלה.")
              }
              className={FIELD}
            />
          </Section>

          <Section title="קבצים">
            <div className="flex flex-wrap gap-2">
              {files.map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink-900 underline-offset-2 hover:underline"
                >
                  <LuPaperclip className="h-3.5 w-3.5 shrink-0" />
                  {file.name}
                </a>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-ink-300 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50">
                <LuPlus className="h-3.5 w-3.5" />
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
              {[...task.events].reverse().map((event, i) => (
                <li key={i} className="text-xs text-muted">
                  <span className="font-medium text-ink-900">{personName(people, event.by)}</span>{" "}
                  {describe(event, people)} · {when(event.at)}
                </li>
              ))}
              <li className="text-xs text-muted">
                {task.kind ? "מילו פתח את המשימה" : "המשימה נוצרה"} · {when(task.created_at)}
              </li>
            </ul>
          </Section>
        </div>

        <aside className="space-y-4 md:sticky md:top-24 md:self-start">
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
          <Field label="מקור">
            <Tag tone={sourceTone(task)}>{sourceLabel(task)}</Tag>
          </Field>
          {(task.name || task.phone) && (
            <Field label="לקוח">
              <p className="text-sm text-ink-900">{task.name}</p>
              {task.phone && (
                <>
                  <p className="text-xs text-muted">
                    <span dir="ltr">{task.phone}</span>
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={() => window.open(`https://wa.me/${task.phone!.replace(/\D/g, "")}`, "_blank", "noopener")}
                  >
                    <LuMessageCircle className="h-4 w-4" />
                    לדבר עם הלקוח בוואטסאפ
                  </Button>
                </>
              )}
            </Field>
          )}
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => openInGoogle("email")}>
              <LuMail className="h-4 w-4" />
              שליחת מייל
            </Button>
            <Button variant="ghost" onClick={() => openInGoogle("meeting")}>
              <LuCalendarDays className="h-4 w-4" />
              קביעת פגישה
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
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
    case "email":
      return event.text ? `פתח/ה מייל ב-Gmail: ${event.text}` : "פתח/ה מייל ב-Gmail";
    case "meeting":
      return `פתח/ה פגישה ביומן: ${event.text}`;
    case "polywizz":
      return event.text ?? "עדכון מ-PolyWizz";
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [chat]);

  return (
    <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto rounded-xl bg-[#efeae2] p-4">
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
                <a
                  href={taskMediaUrl(message.media_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#1f7aec] underline underline-offset-2"
                >
                  <LuPaperclip className="h-3.5 w-3.5" />
                  קובץ
                </a>
              )}
              <p className="mt-1 text-left text-[11px] text-muted">{when(message.at)}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottom} />
    </div>
  );
}
