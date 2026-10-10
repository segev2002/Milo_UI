import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, listTasks, resolveTask, taskConversation, taskMediaUrl } from "../lib/api";
import type { OpenTask, TaskChatMessage, TaskKind } from "../types";
import { Button, Card, Empty, Tag, when } from "./ui";

/**
 * Two kinds: clients whose request needs Sigal, and new numbers Milo did not
 * recognise. Milo talks each one through first, so a task leads with his
 * one-line summary of what the person wants; tapping it opens the WhatsApp
 * conversation behind it. One task per number; marking it "טופל" closes it,
 * and the next message from that number opens a new one. Open and done tasks
 * are separate screens, so `status` comes from the sidebar; the done screen
 * shows both kinds together, newest first.
 */
type Task = OpenTask & { kind: TaskKind };
const TEAM_LABEL = { claims: "תביעות", operations: "תפעול" } as const;

export function Tasks({ status }: { status: "open" | "done" }) {
  const [kind, setKind] = useState<TaskKind>("clients");
  //: null until the first answer, so loading never reads as "no tasks".
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  //: Conversations already fetched, so reopening one is instant. "רענון" clears it.
  const chats = useRef(new Map<string, TaskChatMessage[]>());

  const refresh = useCallback(async () => {
    try {
      const kinds: TaskKind[] = status === "open" ? [kind] : ["clients", "new_clients"];
      const lists = await Promise.all(
        kinds.map(async (k) => (await listTasks(k, status)).map((task) => ({ ...task, kind: k }))),
      );
      const all = lists.flat();
      if (status === "done") all.sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));
      setTasks(all);
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את המשימות.");
    }
  }, [kind, status]);

  useEffect(() => {
    setTasks(null);
    void refresh();
    setOpenId(null);
  }, [refresh]);

  async function resolve(task: Task) {
    if (!confirm(`לסמן את המשימה של ${task.name || task.phone} כטופלה?`)) return;
    setBusy(true);
    try {
      await resolveTask(task.kind, task.id);
      // Done: drop it here rather than reloading the whole list.
      setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? null);
      setError(null);
    } catch (exc) {
      // e.g. someone else marked it first — the refreshed list shows that.
      const failure = exc instanceof ApiError ? exc.message : "הסימון נכשל.";
      await refresh();
      setError(failure);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <div className="flex gap-2">
              {status === "open" && (["clients", "new_clients"] as const).map((option) => (
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  chats.current.clear();
                  void refresh();
                }}
                disabled={busy}
              >
                רענון
              </Button>
            </div>
        </div>
        {error && (
          <p className="mx-5 mt-5 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
            {error}
          </p>
        )}
        {tasks === null ? (
          <p className="px-5 py-12 text-center text-sm text-muted">טוען…</p>
        ) : tasks.length ? (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <p className="text-sm font-medium text-ink-900">{task.name || "ללא שם"}</p>
                    <p className="text-xs text-muted" dir="ltr">
                      {task.phone}
                    </p>
                    <p className="text-xs text-muted" title="ההודעה האחרונה">
                      {dateTime(task.last_message_at)}
                    </p>
                    <Tag>{task.messages.length} הודעות</Tag>
                    {task.team && <Tag tone="warm">{TEAM_LABEL[task.team]}</Tag>}
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
                  {task.messages.some((message) => message.media_url) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.messages
                        .filter((message) => message.media_url)
                        .map((message, i) => (
                          <a
                            key={i}
                            href={taskMediaUrl(message.media_url!)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink-900 underline-offset-2 hover:underline"
                          >
                            קובץ {i + 1}
                          </a>
                        ))}
                    </div>
                  )}
                  {openId === task.id && (
                    <Conversation kind={task.kind} taskId={task.id} cache={chats.current} />
                  )}
                  {task.status === "done" && (
                    <p className="mt-2 text-xs text-muted">
                      טופל {task.resolved_at ? when(task.resolved_at) : ""}
                      {task.resolved_by && ` · על ידי ${task.resolved_by}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {task.status === "open" && (
                    <Button size="sm" disabled={busy} onClick={() => void resolve(task)}>
                      טופל
                    </Button>
                  )}
                  {/* Opens a chat from whichever WhatsApp account is signed in on this device — Sigal's own, not Milo's. */}
                  <a
                    href={`https://wa.me/${task.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:bg-paper"
                  >
                    פתח בוואטסאפ
                  </a>
                </div>
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

/** "9 באוק׳ 14:32" — when the person last wrote to Milo. */
function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The WhatsApp chat behind a task: the customer on the right, Milo on the left. */
function Conversation({
  kind,
  taskId,
  cache,
}: {
  kind: TaskKind;
  taskId: string;
  cache: Map<string, TaskChatMessage[]>;
}) {
  const [chat, setChat] = useState<TaskChatMessage[] | null>(cache.get(taskId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cache.has(taskId)) return;
    taskConversation(kind, taskId)
      .then((messages) => {
        cache.set(taskId, messages);
        setChat(messages);
      })
      .catch((exc) => setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את השיחה."));
  }, [kind, taskId, cache]);

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
