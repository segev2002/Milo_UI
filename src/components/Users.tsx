import { useCallback, useEffect, useState } from "react";
import { ApiError, addUser, listUsers, removeUser, renameUser } from "../lib/api";
import { useCached } from "../lib/cache";
import type { AllowedUser, Identity } from "../types";
import { LuPencil, LuTrash, LuUserPlus } from "react-icons/lu";
import { Modal } from "./Tasks";
import { Button, Card, CardHead, confirmDialog, Empty, Tag, when } from "./ui";

/**
 * The allowlist, and the only screen that writes to it.
 *
 * Adding someone here is the whole of granting access: they sign in with
 * Google on their own, and the server matches the address Google vouched for
 * against this list. There is no invitation to send and no password to set —
 * nothing here knows anything about how they prove who they are.
 *
 * The screen is admin-only, but the server is what enforces that. This
 * component is only ever reached when `me.is_admin`, and every one of its
 * calls would be refused anyway if it were reached some other way.
 */
export function Users({ me }: { me: Identity }) {
  const [users, setUsers] = useCached<AllowedUser[]>("users.list", []);
  const [email, setEmail] = useCached("users.draft.email", "");
  const [name, setName] = useCached("users.draft.name", "");
  const [isAdmin, setIsAdmin] = useCached("users.draft.admin", false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  //: The "הוסף משתמש" dialog.
  const [adding, setAdding] = useState(false);
  //: The user open in the pencil's dialog: their name and whether they are an admin.
  const [editing, setEditing] = useState<{ email: string; name: string; isAdmin: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "לא הצלחתי לטעון את הרשימה.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add() {
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addUser(address, isAdmin, name.trim());
      setEmail("");
      setName("");
      setIsAdmin(false);
      setAdding(false);
      await refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "ההוספה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(address: string) {
    if (!(await confirmDialog({ title: `להסיר את ${address}?`, confirmLabel: "הסרה", danger: true }))) return;
    setBusy(true);
    setError(null);
    try {
      await removeUser(address);
      await refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "ההסרה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  /** The pencil's dialog: the name tasks and their history show, and admin or not. */
  async function saveEdit() {
    if (!editing || busy) return;
    setBusy(true);
    setError(null);
    try {
      const row = await renameUser(editing.email, editing.name.trim(), editing.isAdmin);
      setUsers((prev) => prev.map((user) => (user.email === editing.email ? { ...user, ...row } : user)));
      setEditing(null);
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "השמירה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  const active = users.filter((user) => user.active);

  const errorBox = error && (
    <p className="rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
      {error}
    </p>
  );

  return (
    <div className="space-y-5">
      {!adding && !editing && errorBox}

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <div className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink-900">עריכת משתמש</h2>
            <p className="truncate text-right text-xs text-muted" dir="ltr">
              {editing.email}
            </p>
            <div>
              <label htmlFor="edit-user-name" className="block text-xs font-medium text-ink-900">
                שם מלא
              </label>
              <input
                id="edit-user-name"
                autoFocus
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                onKeyDown={(event) => event.key === "Enter" && void saveEdit()}
                className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-body outline-none focus:border-ink-500 focus:bg-white"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-body">
              <input
                type="checkbox"
                checked={editing.isAdmin}
                disabled={editing.email === me.email}
                onChange={(event) => setEditing({ ...editing, isAdmin: event.target.checked })}
                className="h-4 w-4 accent-ink-900"
              />
              מנהל
            </label>
            {errorBox}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                ביטול
              </Button>
              <Button onClick={() => void saveEdit()} disabled={busy}>
                שמירה
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {adding && (
        <Modal onClose={() => setAdding(false)}>
          <div className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink-900">הוספת משתמש</h2>
            <div>
              <label htmlFor="new-user-name" className="block text-xs font-medium text-ink-900">
                שם מלא
              </label>
              <input
                id="new-user-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void add()}
                placeholder="כפי שיופיע במשימות"
                className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-body outline-none focus:border-ink-500 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="new-user" className="block text-xs font-medium text-ink-900">
                כתובת אימייל
              </label>
              <input
                id="new-user"
                dir="ltr"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void add()}
                placeholder="name@example.com"
                className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-body outline-none focus:border-ink-500 focus:bg-white"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-body">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(event) => setIsAdmin(event.target.checked)}
                className="h-4 w-4 accent-ink-900"
              />
              מנהל
            </label>
            {errorBox}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                ביטול
              </Button>
              <Button onClick={() => void add()} disabled={busy || !email.trim()}>
                הוספה
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Card>
        <CardHead
          right={
            <>
              <Button
                size="sm"
                onClick={() => {
                  setError(null);
                  setAdding(true);
                }}
              >
                <LuUserPlus className="h-4 w-4" />
                הוסף משתמש
              </Button>
              <Tag tone="ink">{active.length} מורשים</Tag>
            </>
          }
        />
        {active.length ? (
          <ul className="divide-y divide-line">
            {active.map((user) => (
              <li key={user.email} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">
                    {user.display_name || <span className="font-normal text-muted/70">ללא שם</span>}
                  </p>
                  <p className="truncate text-right text-xs text-muted" dir="ltr">
                    {user.email}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {user.last_login_at ? `נכנס ${when(user.last_login_at)}` : "טרם נכנס"}
                    {user.added_by && ` · הוסף על ידי ${user.added_by}`}
                  </p>
                </div>
                {user.has_password && <Tag>סיסמה הוגדרה</Tag>}
                {user.is_admin && <Tag tone="warm">מנהל</Tag>}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing({ email: user.email, name: user.display_name ?? "", isAdmin: user.is_admin });
                    }}
                    className="rounded-lg p-2 text-muted hover:bg-paper hover:text-ink-900"
                    aria-label={`עריכת ${user.display_name || user.email}`}
                    title="עריכה"
                  >
                    <LuPencil className="h-4 w-4" />
                  </button>
                  {user.email === me.email ? (
                    // Removing yourself is refused anyway; the space keeps the pencils in one column.
                    <span className="w-8" />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(user.email)}
                      className="rounded-lg p-2 text-muted hover:bg-[#fbeceb] hover:text-blocked disabled:opacity-50"
                      aria-label={`הסרת ${user.display_name || user.email}`}
                      title="הסרה"
                    >
                      <LuTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="אין עדיין משתמשים ברשימה" />
        )}
      </Card>
    </div>
  );
}
