import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ApiError, createTask, deleteTask, listPeople, listTasks, updateTask, uploadTaskFile } from "../lib/api";
import { useCached } from "../lib/cache";
import type { Identity, Person, Task, TaskPriority, TaskStatus } from "../types";
import { LuCalendarClock, LuCalendarDays, LuPlus, LuRefreshCw, LuSearch, LuTrash2, LuX } from "react-icons/lu";
import { FileText } from "lucide-react";
import { dragAs, dueLabel, FilePreview, TaskDetails, type PreviewFile } from "./TaskDetails";
import { Button, DateField, FIELD, Select, Tag, when } from "./ui";

/**
 * The task board: three columns, one small card per task. Milo files tasks from
 * WhatsApp (a client he could not help, a number he did not recognise) and they
 * reach everyone; console users create the rest. Drag a card to another column
 * to change its status, or tap it for the whole task — files, history, and the
 * WhatsApp conversation behind it. Done tasks stay on the board for 14 days.
 */

export const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "new", label: "משימות חדשות" },
  { status: "in_progress", label: "בתהליך" },
  { status: "done", label: "בוצע" },
];

/** The board: claims are new tasks of the claims team, in a column of their own. */
const BOARD: { status: TaskStatus; label: string; claims?: boolean }[] = [
  { status: "new", label: "משימות חדשות", claims: false },
  { status: "new", label: "תביעות", claims: true },
  { status: "in_progress", label: "בתהליך" },
  { status: "done", label: "בוצע" },
];

const TEAM_LABEL = { claims: "תביעות", operations: "תפעול" } as const;

/** How often the board reloads on its own, so Milo's new tasks appear. */
const REFRESH_MS = 60_000;

export function Tasks({ me }: { me: Identity }) {
  //: null until the first answer, so loading never reads as "no tasks".
  const [tasks, setTasks] = useCached<Task[] | null>("tasks.list", null);
  const [people, setPeople] = useCached<Person[]>("tasks.people", []);
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useCached("tasks.assignee", me.email);
  //: Search by the person's name or the task's title.
  const [query, setQuery] = useState("");
  //: `?task=<id>` — the link in the "שויכה אליך משימה" email — opens that task.
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get("task"));
  const [creating, setCreating] = useState<"task" | "claim" | null>(null);
  //: "משימות עתידיות": tasks set for a later day, off the board until it comes.
  const [showFuture, setShowFuture] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את המשימות.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    listPeople()
      // An admin from the server's settings has no saved name; their Google name stands in.
      .then((list) => setPeople(list.map((p) => (p.email === me.email && !p.display_name ? { ...p, display_name: me.display_name } : p))))
      .catch(() => setPeople([]));
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, me.email, me.display_name]);

  /** A task was deleted — from its card or from inside it. */
  const removed = (id: string) => setTasks((prev) => prev?.filter((t) => t.id !== id) ?? null);

  /** A task changed — here or in its card. */
  const replace = (task: Task) =>
    setTasks((prev) => prev?.map((t) => (t.id === task.id ? task : t)) ?? null);

  async function move(id: string, status: TaskStatus) {
    const task = tasks?.find((t) => t.id === id);
    if (!task || task.status === status) return;
    replace({ ...task, status });
    try {
      replace(await updateTask(id, { status }));
    } catch (exc) {
      // e.g. reopened while Milo already opened a new task for the number.
      const failure = exc instanceof ApiError ? exc.message : "העברת המשימה נכשלה.";
      await refresh();
      setError(failure);
    }
  }

  const q = query.trim().toLowerCase();
  const matching = (tasks ?? []).filter(
    (t) =>
      (!assignee || t.assignee === assignee) &&
      (!q || taskTitle(t).toLowerCase().includes(q) || (t.name ?? "").toLowerCase().includes(q)),
  );
  const shown = matching.filter((t) => !isFuture(t));
  const future = matching.filter(isFuture).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  //: Every user, the signed-in one first; an assignee who is no longer a user still gets a line.
  const filterOptions = [
    { value: "", label: "כל המשימות" },
    { value: me.email, label: "המשימות שלי" },
    ...people.filter((p) => p.email !== me.email).map((p) => ({ value: p.email, label: personName(people, p.email) })),
    ...[...new Set((tasks ?? []).map((t) => t.assignee))]
      .filter((e): e is string => !!e && e !== me.email && !people.some((p) => p.email === e))
      .map((e) => ({ value: e, label: personName(people, e) })),
  ];
  const open = tasks?.find((t) => t.id === openId) ?? null;

  return (
    // Columns follow the board's own width, so collapsing the sidebar makes room for more.
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="task" onClick={() => setCreating("task")}>
          <LuPlus className="h-4 w-4" />
          משימה חדשה
        </Button>
        <Button variant="task" onClick={() => setCreating("claim")}>
          <LuPlus className="h-4 w-4" />
          תביעה חדשה
        </Button>
        <Button variant="ghost" onClick={() => setShowFuture(true)}>
          <LuCalendarClock className="h-4 w-4" />
          משימות עתידיות
          {future.length > 0 && (
            <span className="rounded-full bg-ink-900 px-1.5 text-[0.7rem] font-semibold text-champagne">{future.length}</span>
          )}
        </Button>
        <div className="w-48">
          <Select value={assignee} onChange={setAssignee} options={filterOptions} className="py-1.5 text-xs font-medium" />
        </div>
        <label className="relative w-full max-w-xs">
          <LuSearch className="pointer-events-none absolute inset-y-0 right-3 z-10 my-auto h-4 w-4 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם או כותרת"
            aria-label="חיפוש משימות"
            className={`${FIELD} py-1.5 pr-9 text-sm`}
          />
        </label>
        {/* What the card colors mean. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-milo bg-milo/15" />
            מילו פתח את המשימה מהוואטסאפ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-ink-900 bg-white" />
            רגיל
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-important bg-important/15" />
            חשוב
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-urgent bg-urgent/15" />
            דחוף
          </span>
        </div>
        <button
          onClick={() => void refresh()}
          title="רענון"
          aria-label="רענון"
          className="mr-auto rounded-lg border border-line bg-white p-2 text-ink-700 transition-colors hover:bg-paper"
        >
          <LuRefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[0.875rem] leading-relaxed text-blocked">
          {error}
        </p>
      )}

      {tasks === null ? (
        <p className="px-5 py-12 text-center text-sm text-muted">טוען…</p>
      ) : (
        // On a phone the columns stack: new on top, then in progress, then done.
        <div className="grid gap-4 @md:grid-cols-2 @[52rem]:grid-cols-4">
          {BOARD.map((column) => {
            const cards = shown.filter(
              (t) => t.status === column.status && (column.claims === undefined || (t.team === "claims") === column.claims),
            );
            return (
              <section
                key={column.label}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(column.label);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  setDragOver(null);
                  void move(e.dataTransfer.getData("text/plain"), column.status);
                }}
                className={`flex min-h-[7.5rem] flex-col rounded-2xl border p-3 transition-colors md:min-h-[12.5rem] ${
                  dragOver === column.label ? "border-ink-300 bg-ink-50" : "border-line bg-paper"
                }`}
              >
                <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-ink-900">
                  {column.label}
                  <span className="rounded-full bg-white px-2 py-0.5 text-[0.75rem] font-medium text-muted">
                    {cards.length}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {cards.map((task) => (
                    <li key={task.id}>
                      <TaskCard task={task} people={people} me={me} onOpen={() => setOpenId(task.id)} onDeleted={() => removed(task.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {showFuture && (
        <Modal onClose={() => setShowFuture(false)} size="lg">
          <div className="space-y-4 p-5 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink-900">משימות עתידיות</h2>
                <p className="mt-1 text-sm text-muted">כל משימה עולה ללוח ביום שלה, והאחראי/ת מקבל/ת עליה מייל באותו בוקר.</p>
              </div>
              <button onClick={() => setShowFuture(false)} aria-label="סגירה" className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink-900">
                <LuX className="h-5 w-5" />
              </button>
            </div>
            {future.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">אין משימות עתידיות.</p>
            ) : (
              <ul className="space-y-2">
                {future.map((task) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      people={people}
                      me={me}
                      onDeleted={() => removed(task.id)}
                      onOpen={() => {
                        setShowFuture(false);
                        setOpenId(task.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {open && (
        <TaskDetails
          key={open.id}
          task={open}
          people={people}
          me={me}
          onChange={replace}
          onClose={() => setOpenId(null)}
        />
      )}
      {creating && (
        <NewTask
          me={me}
          claim={creating === "claim"}
          people={people}
          onCreated={(task, warning) => {
            setTasks((prev) => [task, ...(prev ?? [])]);
            setCreating(null);
            setError(warning);
          }}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}

/** What the card leads with: its title, else Milo's summary, else the last message. */
/** A task for a later day than today, not done: it waits in "משימות עתידיות". */
function isFuture(task: Task): boolean {
  return task.status !== "done" && !!task.due_date && task.due_date > localDay();
}

/** What each priority is called, and how its card and tag look. רגיל: the source's own look. */
export const PRIORITY: Record<TaskPriority, { label: string; card: string | null }> = {
  normal: { label: "רגיל", card: null },
  important: { label: "חשוב", card: "border-important bg-important/15" },
  urgent: { label: "דחוף", card: "border-urgent bg-urgent/15" },
};

/** Today as "YYYY-MM-DD", on this computer's clock. */
function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function taskTitle(task: Task): string {
  return task.title || task.summary || task.messages[task.messages.length - 1]?.text || "ללא כותרת";
}

/** What Milo opened: from WhatsApp (`kind`), or a call's follow-up the user approved. */
export const byMilo = (task: Task) => !!task.kind || task.created_by === MILO;
/** `created_by` (and an event's `by`) of what Milo opened from the console. */
export const MILO = "milo";

export function sourceLabel(task: Task): string {
  if (task.team) return TEAM_LABEL[task.team];
  if (task.created_by === MILO) return "מילו · שיחה";
  if (task.kind === "clients") return "מילו · לקוח";
  if (task.kind === "new_clients") return "מילו · לקוח חדש";
  return "ידני";
}

/** Ultra violet for what Milo opened; a claim's tag keeps its color (the card is by priority). */
export function sourceTone(task: Task): "claim" | "milo" | "ink" {
  if (task.team === "claims") return "claim";
  return byMilo(task) ? "milo" : "ink";
}

export function personName(people: Person[], email: string | null): string {
  if (!email) return "";
  if (email === MILO) return "מילו";
  return people.find((p) => p.email === email)?.display_name || email.split("@")[0];
}

/** What the user types to delete a task (the same word as for a call or a recording). */
const DELETE_WORD = "מחיקה";

function TaskCard({
  task,
  people,
  me,
  onOpen,
  onDeleted,
}: {
  task: Task;
  people: Person[];
  me: Identity;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  const fileCount = task.files.length + task.messages.filter((m) => m.media_url).length;
  const assignee = personName(people, task.assignee);
  //: The card's trash: an admin's, or whoever opened the task. "מחיקה" is typed to confirm.
  const mayDelete = me.is_admin || task.created_by === me.email;
  const [typed, setTyped] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  async function remove() {
    setDeleting(true);
    try {
      await deleteTask(task.id);
      onDeleted();
    } catch (exc) {
      setFailed(exc instanceof ApiError ? exc.message : "המחיקה נכשלה.");
      setDeleting(false);
    }
  }
  return (
    <div className="group relative">
    {mayDelete && typed === null && (
      <button
        type="button"
        onClick={() => setTyped("")}
        aria-label={`מחיקת המשימה ${taskTitle(task)}`}
        title="מחיקה"
        className="absolute left-1.5 top-1.5 z-10 rounded-lg p-1.5 text-muted opacity-60 transition hover:bg-white hover:text-blocked hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <LuTrash2 className="h-3.5 w-3.5" />
      </button>
    )}
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onOpen}
      className={`w-full cursor-grab rounded-xl border p-3 text-right shadow-sm ${mayDelete ? "pl-8" : ""} ${
        // חשוב / דחוף color the card; רגיל: white, or Milo's violet for what he opened.
        PRIORITY[task.priority ?? "normal"].card ?? (byMilo(task) ? "border-milo bg-milo/15" : "border-ink-900 bg-white")
      } transition-colors active:cursor-grabbing`}
    >
      <div className="flex items-start gap-2">
        {/* What Milo opened carries his face, so it reads before the color does. */}
        {byMilo(task) && (
          <img src="/milo.png" alt="מילו" title={task.kind ? "מילו פתח מהוואטסאפ" : "מילו פתח מהשיחה"} className="h-6 w-6 shrink-0 rounded-md bg-champagne object-cover" />
        )}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900">{taskTitle(task)}</p>
      </div>
      {(task.name || task.phone) && (
        <p className="mt-1 truncate text-xs text-muted">{task.name || <span dir="ltr">{task.phone}</span>}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag tone={sourceTone(task)}>{sourceLabel(task)}</Tag>
        {task.priority && task.priority !== "normal" && (
          <span
            className={`rounded-md px-2 py-0.5 text-[0.75rem] font-semibold text-white ${task.priority === "urgent" ? "bg-urgent" : "bg-important"}`}
          >
            {PRIORITY[task.priority].label}
          </span>
        )}
        {fileCount > 0 && (
          <Tag>
            <FileText className="ml-1 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {fileCount}
          </Tag>
        )}
        {task.link_url && <Tag tone="milo">{task.link_label || "קישור"}</Tag>}
        {task.due_date && (
          // Past its day and not done: red.
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold ${
              task.status !== "done" && task.due_date < localDay()
                ? "border-blocked/40 bg-blocked/10 text-blocked"
                : "border-line bg-white text-ink-700"
            }`}
          >
            <LuCalendarDays className="h-3.5 w-3.5" aria-hidden />
            {dueLabel(task.due_date)}
          </span>
        )}
        <span className="mr-auto text-[0.75rem] text-muted">{when(task.last_message_at)}</span>
        {assignee && (
          <span
            title={assignee}
            className="max-w-[45%] truncate rounded-full bg-ink-900 px-2 py-0.5 text-[0.75rem] font-semibold text-champagne"
          >
            {assignee}
          </span>
        )}
      </div>
    </button>
    {typed !== null && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim() === DELETE_WORD && !deleting) void remove();
        }}
        className="mt-1 flex items-center gap-1.5 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] p-2 text-xs"
      >
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setTyped(null)}
          placeholder={`הקלידו "${DELETE_WORD}" למחיקה`}
          aria-label={`הקלידו ${DELETE_WORD} כדי למחוק את המשימה`}
          className="min-w-0 flex-1 rounded-md border border-[#f3d3d0] bg-white px-2 py-1 text-xs text-ink-900 outline-none placeholder:text-blocked/70 focus:border-blocked"
        />
        <button type="submit" disabled={deleting || typed.trim() !== DELETE_WORD} className="rounded-md bg-blocked px-2.5 py-1 font-semibold text-white disabled:opacity-40">
          מחיקה
        </button>
        <button type="button" onClick={() => setTyped(null)} className="rounded-md border border-line bg-white px-2.5 py-1 text-ink-900">
          ביטול
        </button>
      </form>
    )}
    {failed && <p className="mt-1 text-xs text-blocked">{failed}</p>}
    </div>
  );
}

function NewTask({
  me,
  claim,
  people,
  onCreated,
  onClose,
}: {
  me: Identity;
  /** "תביעה חדשה": the same form, filed for the claims team. */
  claim: boolean;
  people: Person[];
  /** `warning`: the task was created, but some files did not upload. */
  onCreated: (task: Task, warning: string | null) => void;
  onClose: () => void;
}) {
  // Whoever opens the task owns it unless they pick someone else.
  const [form, setForm] = useState({ title: "", description: "", name: "", phone: "", assignee: me.email, due_date: "" });
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [files, setFiles] = useState<File[]>([]);
  //: A picked file, opened to look at before the task is created (the same viewer as a task's files).
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Empty fields are left out, not sent as "".
      const fields = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      let task = await createTask({
        ...(fields as typeof form),
        priority,
        ...(claim && { team: "claims" as const }),
      });
      // The task exists now, so a file that fails does not undo it: it is named instead.
      const failed: string[] = [];
      for (const file of files) {
        try {
          task = await uploadTaskFile(task.id, file);
        } catch {
          failed.push(file.name);
        }
      }
      onCreated(task, failed.length ? `המשימה נוצרה, אבל הקבצים האלה לא עלו: ${failed.join(", ")}. אפשר לצרף אותם מתוך המשימה.` : null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "יצירת המשימה נכשלה.");
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} size="lg">
      {/* Compact enough to fit one screen: the description is short (it grows as it is typed into
          in the task itself), and date, priority and assignee share a row. */}
      <form onSubmit={(e) => void submit(e)} className="space-y-4 p-5 sm:p-7">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{claim ? "תביעה חדשה" : "משימה חדשה"}</h2>
        <Labelled label="כותרת">
          <input required autoFocus value={form.title} onChange={set("title")} className={`${FIELD} text-base`} />
        </Labelled>
        <Labelled label="תיאור">
          <textarea rows={3} value={form.description} onChange={set("description")} className={`${FIELD} resize-y text-base`} />
        </Labelled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="שם הלקוח" hint="לא חובה">
            <input value={form.name} onChange={set("name")} className={`${FIELD} text-base`} />
          </Labelled>
          <Labelled label="טלפון" hint="לא חובה">
            <input dir="ltr" value={form.phone} onChange={set("phone")} className={`${FIELD} text-right text-base`} />
          </Labelled>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink-900">
              תאריך<span className="mr-2 text-xs font-normal text-muted">לא חובה</span>
            </span>
            <DateField
              value={form.due_date}
              placeholder="ללא תאריך"
              onChange={(due_date) => setForm({ ...form, due_date })}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink-900">עדיפות</span>
            <div role="radiogroup" aria-label="עדיפות" className="flex gap-1.5">
              {(Object.keys(PRIORITY) as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                    priority === p
                      ? p === "urgent"
                        ? "border-urgent bg-urgent text-white"
                        : p === "important"
                          ? "border-important bg-important text-white"
                          : "border-ink-900 bg-ink-900 text-champagne"
                      : "border-line bg-white text-ink-700 hover:bg-paper"
                  }`}
                >
                  {PRIORITY[p].label}
                </button>
              ))}
            </div>
          </div>
          <Labelled label="אחראי/ת">
            <Select
              value={form.assignee}
              onChange={(assignee) => setForm({ ...form, assignee })}
              options={[
                { value: "", label: "ללא שיוך" },
                // The default is the signed-in user, so they are listed even before the people load.
                ...(people.some((p) => p.email === me.email) ? [] : [{ value: me.email, label: me.display_name || me.email }]),
                ...people.map((p) => ({ value: p.email, label: p.display_name || p.email })),
              ]}
            />
          </Labelled>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-900">
            קבצים<span className="mr-2 text-xs font-normal text-muted">עד 20MB לקובץ</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              // The same tile as a task's own files: click to look at it, the trash to drop it.
              <div
                key={i}
                className="inline-flex max-w-full items-center rounded-xl border border-line bg-white transition hover:border-ink-300 hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setPreview({ name: file.name, key: "", url: URL.createObjectURL(file), pdf: "" })}
                  title="לחיצה לתצוגה"
                  className="inline-flex min-w-0 items-center gap-2.5 py-1.5 pl-1 pr-1.5 text-right"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blocked/10 text-blocked">
                    <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[14rem] truncate text-sm font-medium text-ink-900">{file.name}</span>
                    <span className="block text-[0.75rem] text-muted">{dragAs({ name: file.name, key: "", url: "", pdf: "" }).label}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`הסרת ${file.name}`}
                  title="הסרה"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="ml-1.5 rounded-md p-1.5 text-muted hover:bg-blocked/10 hover:text-blocked"
                >
                  <LuTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-ink-300 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50">
              <LuPlus className="h-4 w-4" />
              צירוף קבצים
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  setFiles([...files, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-blocked">{error}</p>}
        <div className="flex gap-2 border-t border-line pt-5">
          <Button type="submit" disabled={busy}>
            {busy && files.length ? "מעלה קבצים…" : "יצירת המשימה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </form>
      {preview && <FilePreview file={preview} onClose={closePreview} />}
    </Modal>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-900">
        {label}
        {hint && <span className="mr-2 text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** A centred panel over a dimmed page. Escape or a click outside closes it.
    Rendered on <body>, so scrolling inside it never moves the page behind. */
/** The popups open now, the top one last: one opened over another (a task over a list)
    shares the page's scroll freeze, and Escape closes only the top one. */
const openModals: object[] = [];
let scrollBefore: { root: HTMLElement; overflow: string }[] = [];

export function Modal({
  children,
  onClose,
  size = "md",
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
}) {
  const [self] = useState(() => ({}));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openModals[openModals.length - 1] === self && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, self]);

  // While open, the page behind is frozen: its scroll area stops scrolling, and a
  // wheel or swipe on the dimmed backdrop goes nowhere. The first popup freezes it,
  // the last one to close lets it go, whatever order they close in.
  const backdrop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openModals.length === 0) {
      scrollBefore = [...document.querySelectorAll<HTMLElement>("[data-scroll-root]")].map((root) => ({
        root,
        overflow: root.style.overflow,
      }));
      scrollBefore.forEach(({ root }) => (root.style.overflow = "hidden"));
    }
    openModals.push(self);
    const el = backdrop.current;
    const block = (e: Event) => e.target === el && e.preventDefault();
    el?.addEventListener("wheel", block, { passive: false });
    el?.addEventListener("touchmove", block, { passive: false });
    return () => {
      openModals.splice(openModals.indexOf(self), 1);
      if (openModals.length === 0) {
        scrollBefore.forEach(({ root, overflow }) => (root.style.overflow = overflow));
        scrollBefore = [];
      }
      el?.removeEventListener("wheel", block);
      el?.removeEventListener("touchmove", block);
    };
  }, [self]);

  return createPortal(
    <div
      ref={backdrop}
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-ink-950/40 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* On a phone, a sheet up from the bottom with a grip; from sm up, a centred panel.
          The panel scrolls inside itself; "xl" fills the screen's height. */}
      <div
        className={`milo-sheet flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-full sm:rounded-2xl ${
          { md: "sm:max-w-lg", lg: "sm:max-w-4xl", xl: "h-[94dvh] sm:h-full sm:max-w-7xl" }[size]
        }`}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-11 rounded-full bg-ink-300/60" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:pb-0">
        {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
