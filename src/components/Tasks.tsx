import { useCallback, useEffect, useState } from "react";
import { ApiError, listTasks, resolveTask } from "../lib/api";
import type { OpenTask } from "../types";
import { Button, Card, CardHead, Empty, Tag } from "./ui";
import { when } from "./Dashboard";

/**
 * Messages from numbers Milo did not recognise. He told each of them
 * "הבנתי שזה דחוף. אני מעביר לסיגל עכשיו." — this is where they arrive.
 * One task per number; marking it "טופל" closes it, and the next message from
 * that number opens a new one.
 */
export function Tasks() {
  const [status, setStatus] = useState<"open" | "done">("open");
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks(status));
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את המשימות.");
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function resolve(task: OpenTask) {
    if (!confirm(`לסמן את המשימה של ${task.name || task.phone} כטופלה?`)) return;
    setBusy(true);
    let failure: string | null = null;
    try {
      await resolveTask(task.id);
    } catch (exc) {
      // e.g. someone else marked it first — the refreshed list shows that.
      failure = exc instanceof ApiError ? exc.message : "הסימון נכשל.";
    }
    await refresh();
    setError(failure);
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHead
          title="משימות פתוחות"
          hint="הודעות ממספרים שמילו לא זיהה במערכת"
          right={
            <div className="flex gap-2">
              {(["open", "done"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setStatus(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    status === option
                      ? "border-ink-900 bg-ink-900 text-champagne"
                      : "border-line bg-white text-body hover:border-ink-300"
                  }`}
                >
                  {option === "open" ? "פתוחות" : "טופלו"}
                </button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={busy}>
                רענון
              </Button>
            </div>
          }
        />
        {error && (
          <p className="mx-5 mt-5 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
            {error}
          </p>
        )}
        {tasks.length ? (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <p className="text-sm font-medium text-ink-900">{task.name || "ללא שם"}</p>
                    <p className="text-xs text-muted" dir="ltr">
                      {task.phone}
                    </p>
                    <Tag>{task.messages.length} הודעות</Tag>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {task.messages.map((message, i) => (
                      <li key={i} className="text-sm leading-relaxed text-body">
                        <span className="text-xs text-muted">{when(message.at)} · </span>
                        {message.text}
                      </li>
                    ))}
                  </ul>
                  {task.status === "done" && (
                    <p className="mt-2 text-xs text-muted">
                      טופל {task.resolved_at ? when(task.resolved_at) : ""}
                      {task.resolved_by && ` · על ידי ${task.resolved_by}`}
                    </p>
                  )}
                </div>
                {task.status === "open" && (
                  <Button size="sm" disabled={busy} onClick={() => void resolve(task)}>
                    טופל
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={status === "open" ? "אין משימות פתוחות" : "אין משימות שטופלו"} />
        )}
      </Card>
    </div>
  );
}
