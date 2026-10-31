import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ApiError, createTask, listPeople, listTasks, updateTask, uploadTaskFile } from "../lib/api";
import { useCached } from "../lib/cache";
import type { Identity, Person, Task, TaskStatus } from "../types";
import { LuPaperclip, LuPlus, LuRefreshCw, LuX } from "react-icons/lu";
import { TaskDetails } from "./TaskDetails";
import { Button, FIELD, Select, Tag, when } from "./ui";

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
  const [mine, setMine] = useCached("tasks.mine", true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<"task" | "claim" | null>(null);
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

  const shown = (tasks ?? []).filter((t) => !mine || t.assignee === me.email);
  const open = tasks?.find((t) => t.id === openId) ?? null;

  return (
    // Columns follow the board's own width, so collapsing the sidebar makes room for more.
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="task" onClick={() => setCreating("task")}>
          <LuPlus className="h-4 w-4" />
          משימה חדשה
        </Button>
        <Button variant="claim" onClick={() => setCreating("claim")}>
          <LuPlus className="h-4 w-4" />
          תביעה חדשה
        </Button>
        <button
          onClick={() => setMine(!mine)}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            mine ? "border-ink-900 bg-ink-900 text-champagne" : "border-line bg-white text-body hover:border-ink-300"
          }`}
        >
          המשימות שלי
        </button>
        {/* What the card colors mean. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-milo bg-milo/15" />
            מילו פתח את המשימה מהוואטסאפ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-claim bg-claim/15" />
            תביעה
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-ink-900 bg-white" />
            משימה שנפתחה בקונסולה
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
        <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
          {error}
        </p>
      )}

      {tasks === null ? (
        <p className="px-5 py-12 text-center text-sm text-muted">טוען…</p>
      ) : (
        // On a phone the columns stack: new on top, then in progress, then done.
        <div className="grid gap-4 @md:grid-cols-2 @[60rem]:grid-cols-4">
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
                className={`flex min-h-[120px] flex-col rounded-2xl border p-3 transition-colors md:min-h-[200px] ${
                  dragOver === column.label ? "border-ink-300 bg-ink-50" : "border-line bg-paper"
                }`}
              >
                <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-ink-900">
                  {column.label}
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-muted">
                    {cards.length}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {cards.map((task) => (
                    <li key={task.id}>
                      <TaskCard task={task} people={people} onOpen={() => setOpenId(task.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
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
export function taskTitle(task: Task): string {
  return task.title || task.summary || task.messages[task.messages.length - 1]?.text || "ללא כותרת";
}

export function sourceLabel(task: Task): string {
  if (task.team) return TEAM_LABEL[task.team];
  if (task.kind === "clients") return "מילו · לקוח";
  if (task.kind === "new_clients") return "מילו · לקוח חדש";
  return "ידני";
}

/** Claim color for claims, ultra violet for what Milo opened. */
export function sourceTone(task: Task): "claim" | "milo" | "ink" {
  if (task.team === "claims") return "claim";
  return task.kind ? "milo" : "ink";
}

export function personName(people: Person[], email: string | null): string {
  if (!email) return "";
  return people.find((p) => p.email === email)?.display_name || email.split("@")[0];
}

function TaskCard({ task, people, onOpen }: { task: Task; people: Person[]; onOpen: () => void }) {
  const fileCount = task.files.length + task.messages.filter((m) => m.media_url).length;
  const assignee = personName(people, task.assignee);
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onOpen}
      className={`w-full cursor-grab rounded-xl border p-3 text-right shadow-sm ${
        { claim: "border-claim bg-claim/15", milo: "border-milo bg-milo/15", ink: "border-ink-900 bg-white" }[
          sourceTone(task)
        ]
      } transition-colors active:cursor-grabbing`}
    >
      <div className="flex items-start gap-2">
        {/* What Milo opened carries his face, so it reads before the color does. */}
        {task.kind && (
          <img src="/milo.png" alt="מילו" title="מילו פתח מהוואטסאפ" className="h-6 w-6 shrink-0 rounded-md bg-champagne object-cover" />
        )}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900">{taskTitle(task)}</p>
      </div>
      {(task.name || task.phone) && (
        <p className="mt-1 truncate text-xs text-muted">{task.name || <span dir="ltr">{task.phone}</span>}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag tone={sourceTone(task)}>{sourceLabel(task)}</Tag>
        {fileCount > 0 && <Tag>📎 {fileCount}</Tag>}
        {task.link_url && <Tag tone="milo">{task.link_label || "קישור"}</Tag>}
        <span className="mr-auto text-[11px] text-muted">{when(task.last_message_at)}</span>
        {assignee && (
          <span
            title={assignee}
            className="max-w-[45%] truncate rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-champagne"
          >
            {assignee}
          </span>
        )}
      </div>
    </button>
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
  const [form, setForm] = useState({ title: "", description: "", name: "", phone: "", assignee: me.email });
  const [files, setFiles] = useState<File[]>([]);
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
      let task = await createTask({ ...(fields as typeof form), ...(claim && { team: "claims" as const }) });
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
      <form onSubmit={(e) => void submit(e)} className="space-y-5 p-5 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-ink-900">{claim ? "תביעה חדשה" : "משימה חדשה"}</h2>
        <Labelled label="כותרת" hint="במשפט אחד: מה צריך לעשות">
          <input required autoFocus value={form.title} onChange={set("title")} className={`${FIELD} text-base`} />
        </Labelled>
        <Labelled label="תיאור" hint="כל מה שמי שמטפל צריך לדעת">
          <textarea rows={7} value={form.description} onChange={set("description")} className={`${FIELD} text-base`} />
        </Labelled>
        <div className="grid gap-5 sm:grid-cols-2">
          <Labelled label="שם הלקוח" hint="לא חובה">
            <input value={form.name} onChange={set("name")} className={`${FIELD} text-base`} />
          </Labelled>
          <Labelled label="טלפון" hint="לא חובה">
            <input dir="ltr" value={form.phone} onChange={set("phone")} className={`${FIELD} text-right text-base`} />
          </Labelled>
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
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-900">
            קבצים<span className="mr-2 text-xs font-normal text-muted">עד 20MB לקובץ</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink-900"
              >
                <LuPaperclip className="h-3.5 w-3.5 shrink-0" />
                {file.name}
                <button
                  type="button"
                  aria-label={`הסרת ${file.name}`}
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="text-muted hover:text-blocked"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-ink-300 px-2.5 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
              <LuPlus className="h-3.5 w-3.5" />
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
export function Modal({
  children,
  onClose,
  size = "md",
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // While open, the page behind is frozen: its scroll area stops scrolling, and a
  // wheel or swipe on the dimmed backdrop goes nowhere.
  const backdrop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const roots = [...document.querySelectorAll<HTMLElement>("[data-scroll-root]")];
    const before = roots.map((r) => r.style.overflow);
    roots.forEach((r) => (r.style.overflow = "hidden"));
    const el = backdrop.current;
    const block = (e: Event) => e.target === el && e.preventDefault();
    el?.addEventListener("wheel", block, { passive: false });
    el?.addEventListener("touchmove", block, { passive: false });
    return () => {
      roots.forEach((r, i) => (r.style.overflow = before[i]));
      el?.removeEventListener("wheel", block);
      el?.removeEventListener("touchmove", block);
    };
  }, []);

  return createPortal(
    <div
      ref={backdrop}
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-ink-950/40 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Full screen on a phone. The panel scrolls inside itself; "xl" fills the screen's height. */}
      <div
        className={`h-full w-full overflow-y-auto overscroll-contain bg-white shadow-xl sm:max-h-full sm:rounded-2xl ${
          { md: "sm:h-auto sm:max-w-lg", lg: "sm:h-auto sm:max-w-4xl", xl: "sm:max-w-7xl" }[size]
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
