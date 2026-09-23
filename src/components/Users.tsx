import { useCallback, useEffect, useState } from "react";
import { ApiError, addUser, listUsers, removeUser } from "../lib/api";
import type { AllowedUser, Identity } from "../types";
import { Button, Card, CardHead, Empty, Tag } from "./ui";
import { when } from "./Dashboard";

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
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await addUser(address, isAdmin);
      setEmail("");
      setIsAdmin(false);
      await refresh();
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : "ההוספה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(address: string) {
    if (!confirm(`להסיר את ${address}? הגישה שלו לקונסולה תיפסק מיד.`)) return;
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

  const active = users.filter((user) => user.active);

  return (
    <div className="space-y-5">
      <Card>
        <CardHead
          title="הוספת משתמש"
          hint="הכניסו כתובת Gmail. מי שתוסיפו יוכל להיכנס עם Google, בלי סיסמה ובלי הזמנה."
        />
        <div className="flex flex-wrap items-end gap-3 px-5 py-5">
          <div className="min-w-[260px] flex-1">
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
          <label className="flex items-center gap-2 pb-2.5 text-xs text-body">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(event) => setIsAdmin(event.target.checked)}
              className="h-4 w-4 accent-ink-900"
            />
            מנהל — יוכל גם להוסיף ולהסיר משתמשים
          </label>
          <Button onClick={() => void add()} disabled={busy || !email.trim()} className="mb-0.5">
            הוספה
          </Button>
        </div>
        {error && (
          <p className="mx-5 mb-5 rounded-xl border border-[#f3d3d0] bg-[#fbeceb] px-4 py-3 text-[13px] leading-relaxed text-blocked">
            {error}
          </p>
        )}
      </Card>

      <Card>
        <CardHead
          title="מי מורשה"
          hint="הסרה מפסיקה את הגישה מיד, גם באמצע שיחה"
          right={<Tag tone="ink">{active.length} מורשים</Tag>}
        />
        {active.length ? (
          <ul className="divide-y divide-line">
            {active.map((user) => (
              <li key={user.email} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900" dir="ltr">
                    {user.email}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {user.last_login_at ? `נכנס ${when(user.last_login_at)}` : "טרם נכנס"}
                    {user.added_by && ` · הוסף על ידי ${user.added_by}`}
                  </p>
                </div>
                {user.is_admin && <Tag tone="warm">מנהל</Tag>}
                {user.email === me.email ? (
                  <span className="text-xs text-muted">זה אתם</span>
                ) : (
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove(user.email)}>
                    הסרה
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="אין עדיין משתמשים ברשימה"
            hint="הכתובת של סיגל מוגדרת בשרת ולכן היא נכנסת בכל מקרה, גם כשהרשימה ריקה."
          />
        )}
      </Card>

      <p className="px-1 pb-2 text-xs leading-relaxed text-muted">
        הרשימה הזו היא ההרשאה עצמה — היא נבדקת מחדש בכל פנייה לשרת, לא רק בכניסה. Google רק מוכיח
        מי האדם; מה שקובע אם הוא נכנס זה שהכתובת שלו מופיעה כאן.
      </p>
    </div>
  );
}
