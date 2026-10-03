import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, listTasks, resolveTask, taskConversation } from "../lib/api";
import type { OpenTask, TaskChatMessage, TaskKind } from "../types";
import { Button, Card, CardHead, Empty, Tag } from "./ui";
import { when } from "./Dashboard";

/**
 * Two kinds: clients whose request needs Sigal, and new numbers Milo did not
 * recognise. Milo talks each one through first, so a task leads with his
 * one-line summary of what the person wants; tapping it opens the WhatsApp
 * conversation behind it. One task per number; marking it "טופל" closes it,
 * and the next message from that number opens a new one.
 */
export function Tasks() {
  const [kind, setKind] = useState<TaskKind>("clients");
  const [status, setStatus] = useState<"open" | "done">("open");
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks(kind, status));
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את המשימות.");
    }
  }, [kind, status]);

  useEffect(() => {
    void refresh();
    setOpenId(null);
  }, [refresh]);

  async function resolve(task: OpenTask) {
    if (!confirm(`לסמן את המשימה של ${task.name || task.phone} כטופלה?`)) return;
    setBusy(true);
    let failure: string | null = null;
    try {
      await resolveTask(kind, task.id);
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
          hint={kind === "clients" ? "בקשות של לקוחות שמילו לא יכול היה לטפל בהן" : "הודעות ממספרים שמילו לא זיהה במערכת"}
          right={
            <div className="flex gap-2">
              {(["clients", "new_clients"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setKind(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    kind === option
                      ? "border-ink-900 bg-ink-900 text-champagne"
                      : "border-line bg-white text-body hover:border-ink-300"
                  }`}
                >
                  {option === "clients" ? "לקוחות" : "לקוחות חדשים"}
                </button>
              ))}
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
                  <button
                    onClick={() => setOpenId(openId === task.id ? null : task.id)}
                    className="mt-2 flex w-full items-start gap-2 rounded-xl border border-line bg-white px-3 py-2 text-right text-sm font-semibold leading-relaxed text-ink-900 transition-colors hover:border-ink-300"
                  >
                    <span className="flex-1">
                      {task.summary || task.messages[task.messages.length - 1]?.text || "ללא סיכום"}
                    </span>
                    <span className="text-xs font-normal text-muted">
                      {openId === task.id ? "סגירת השיחה ▴" : "לשיחה המלאה ▾"}
                    </span>
                  </button>
                  {openId === task.id && <Conversation kind={kind} taskId={task.id} />}
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

/** The WhatsApp chat behind a task: the customer on the right, Milo on the left. */
function Conversation({ kind, taskId }: { kind: TaskKind; taskId: string }) {
  const [chat, setChat] = useState<TaskChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    taskConversation(kind, taskId)
      .then(setChat)
      .catch((exc) => setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את השיחה."));
  }, [kind, taskId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [chat]);

  if (error) return <p className="mt-3 text-sm text-blocked">{error}</p>;
  if (!chat) return <p className="mt-3 text-sm text-muted">טוען את השיחה…</p>;
  if (!chat.length) return <p className="mt-3 text-sm text-muted">אין הודעות שמורות לשיחה הזו.</p>;

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
              <p className="mt-1 text-left text-[11px] text-muted">{when(message.at)}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottom} />
    </div>
  );
}
