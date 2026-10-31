import { useCallback, useEffect, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuTarget } from "react-icons/lu";
import { ApiError, listNotifications, markAllNotificationsRead, markNotificationRead } from "../lib/api";
import type { MiloNotification } from "../types";
import { Modal } from "./Tasks";
import { Button, Empty, when } from "./ui";

/** How often the badge asks for new notifications. Milo posts once a morning. */
const POLL_MS = 5 * 60_000;

/**
 * Milo's picture at the top of the sidebar, with a badge for what he has to
 * tell the admins (each morning's campaign check). A click opens them, one at a
 * time, with the list beside it to move between them.
 *
 * Admins only: for everyone else it is the plain picture it always was.
 */
export function MiloNotifications({
  enabled,
  onOpenCampaign,
}: {
  enabled: boolean;
  onOpenCampaign: (campaignId: string) => void;
}) {
  const [items, setItems] = useState<MiloNotification[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setItems(await listNotifications());
    } catch {
      // Quietly: a badge that fails to update is not worth an error on every screen.
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  const unread = items.filter((n) => !n.read_at).length;
  const picture = <img src="/milo.png" alt="מילו" className="h-9 w-9 shrink-0 rounded-xl bg-champagne object-cover" />;
  if (!enabled) return picture;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread ? `${unread} התראות חדשות ממילו` : "התראות ממילו"}
        title={unread ? `${unread} התראות חדשות` : "התראות"}
        className="relative shrink-0 rounded-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
      >
        {picture}
        {unread > 0 && (
          <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-claim px-1 text-[11px] font-bold leading-none text-white ring-2 ring-ink-900">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <NotificationsPanel
          items={items}
          onChange={setItems}
          onClose={() => setOpen(false)}
          onOpenCampaign={(id) => {
            setOpen(false);
            onOpenCampaign(id);
          }}
        />
      )}
    </>
  );
}

function NotificationsPanel({
  items,
  onChange,
  onClose,
  onOpenCampaign,
}: {
  items: MiloNotification[];
  onChange: (items: MiloNotification[]) => void;
  onClose: () => void;
  onOpenCampaign: (campaignId: string) => void;
}) {
  //: Opens on the newest unread one, or the newest.
  const [index, setIndex] = useState(() => Math.max(items.findIndex((n) => !n.read_at), 0));
  const [error, setError] = useState<string | null>(null);
  const current = items[index];

  // Seen is read.
  useEffect(() => {
    if (!current || current.read_at) return;
    const readAt = new Date().toISOString();
    onChange(items.map((n) => (n.id === current.id ? { ...n, read_at: readAt } : n)));
    markNotificationRead(current.id).catch((exc) => setError(exc instanceof ApiError ? exc.message : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  async function readAll() {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      onChange(items.map((n) => ({ ...n, read_at: n.read_at ?? readAt })));
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "העדכון נכשל.");
    }
  }

  return (
    <Modal onClose={onClose} size="xl">
      <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-8">
        <div className="flex items-center gap-4">
          <img src="/milo.png" alt="" className="h-12 w-12 rounded-xl bg-champagne object-cover" />
          <h2 className="font-display text-3xl font-bold text-ink-900">התראות ממילו</h2>
        </div>
        <div className="flex gap-2">
          {items.some((n) => !n.read_at) && (
            <Button size="sm" variant="ghost" onClick={() => void readAll()}>
              סימון הכל כנקרא
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            סגירה
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty title="אין התראות" hint="כשתגדירו מבצע, מילו יעדכן כאן כל בוקר אם הגעתם ליעד ומה נשאר." />
      ) : (
        <div className="grid min-h-0 flex-1 sm:grid-cols-[340px_1fr]">
          <ul className="max-h-[40vh] overflow-y-auto border-b border-line sm:max-h-none sm:border-b-0 sm:border-l">
            {items.map((n, i) => (
              <li key={n.id}>
                <button
                  onClick={() => setIndex(i)}
                  className={`flex w-full items-start gap-3 border-b border-line/70 px-5 py-4 text-start transition-colors ${
                    i === index ? "bg-ink-50" : "hover:bg-paper"
                  }`}
                >
                  <span
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-claim"}`}
                    aria-label={n.read_at ? undefined : "חדש"}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold text-ink-900">{n.title}</span>
                    <span className="mt-1 block text-xs font-bold text-muted">{when(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <div className="flex flex-col gap-6 p-6 sm:p-10">
              <div>
                <p className="text-sm font-bold text-muted">
                  {new Date(current.created_at).toLocaleString("he-IL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <h3 className="mt-2 font-display text-3xl font-bold text-ink-900">{current.title}</h3>
                <p className="mt-5 whitespace-pre-line text-xl font-bold leading-relaxed text-body">{current.body}</p>
              </div>
              {current.campaign_id && (
                <div>
                  <Button variant="warm" onClick={() => onOpenCampaign(current.campaign_id!)} className="font-bold">
                    <LuTarget className="h-4 w-4" />
                    למבצע
                  </Button>
                </div>
              )}
              {error && <p className="text-sm text-blocked">{error}</p>}
              <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
                {/* RTL: the newer one is to the right. */}
                <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                  <LuChevronRight className="h-4 w-4" />
                  חדשה יותר
                </Button>
                <span className="text-sm font-bold text-muted">
                  {index + 1} מתוך {items.length}
                </span>
                <Button size="sm" variant="ghost" disabled={index === items.length - 1} onClick={() => setIndex(index + 1)}>
                  ישנה יותר
                  <LuChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </Modal>
  );
}
