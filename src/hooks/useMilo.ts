import { useCallback, useState } from "react";
import { ApiError, sendTurn } from "../lib/api";
import { activityStore } from "../lib/activity";
import type { ChatMessage, TurnRequest } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10);

const OPENING: ChatMessage = {
  id: "opening",
  role: "milo",
  text: "בוקר טוב, סיגל. אפשר לשאול אותי כל דבר על התיקים — הרשימה שלך להיום, תיק של לקוח, מי נעלם. אני עונה רק מה-CRM ומהמערכות, ואם אני לא יודע אני אומר את זה.",
  at: new Date().toISOString(),
};

export function useMilo() {
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING]);
  const [busy, setBusy] = useState(false);

  const ask = useCallback(
    async (prompt: string, request: TurnRequest = {}, source: "chat" | "scenario" = "chat") => {
      const label = prompt.trim();
      if (!label && !request.intent) return;

      const askedAt = new Date().toISOString();
      const outgoing: ChatMessage = { id: uid(), role: "sigal", text: label, at: askedAt };
      const placeholderId = uid();
      setMessages((prev) => [
        ...prev,
        outgoing,
        { id: placeholderId, role: "milo", text: "", at: askedAt, pending: true },
      ]);
      setBusy(true);

      const started = performance.now();
      try {
        const result = await sendTurn({ message: label, ...request });
        const durationMs = Math.round(performance.now() - started);

        setMessages((prev) =>
          prev.map((message) =>
            message.id === placeholderId
              ? {
                  ...message,
                  pending: false,
                  text: result.reply,
                  intent: result.intent,
                  status: result.status,
                  report: result.report,
                  data: result.data ?? null,
                  missing_information: result.missing_information,
                  awaiting: result.awaiting,
                  withheld: result.withheld,
                  durationMs,
                }
              : message,
          ),
        );

        // A scenario node puts these on the report; a halt puts them at the
        // top level. Counting only one of the two undercounts what needs Sigal.
        // Not every backend build sends them, so treat absence as none.
        const missing = Math.max(
          result.missing_information.length,
          result.report?.missing_information.length ?? 0,
        );
        const awaiting = Math.max(
          (result.awaiting ?? []).length,
          result.report?.awaiting.length ?? 0,
        );

        activityStore.add({
          id: placeholderId,
          at: askedAt,
          source,
          prompt: label || (request.intent ?? ""),
          intent: result.intent,
          status: result.status,
          reportTitle: result.report?.title ?? null,
          reportStatus: result.report?.status ?? null,
          ok: result.status !== "error",
          durationMs,
          missingCount: missing,
          awaitingCount: awaiting,
          withheldCount: (result.withheld ?? []).length,
        });

        if (request.intent === "restart") setMessages([OPENING]);
        return result;
      } catch (error) {
        const durationMs = Math.round(performance.now() - started);
        const text =
          error instanceof ApiError ? error.message : "משהו השתבש בפנייה למילו.";
        setMessages((prev) =>
          prev.map((message) =>
            message.id === placeholderId
              ? { ...message, pending: false, failed: true, text, durationMs }
              : message,
          ),
        );
        activityStore.add({
          id: placeholderId,
          at: askedAt,
          source,
          prompt: label || (request.intent ?? ""),
          intent: request.intent ?? null,
          status: "error",
          reportTitle: null,
          reportStatus: null,
          ok: false,
          durationMs,
          missingCount: 0,
          awaitingCount: 0,
          withheldCount: 0,
        });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const reset = useCallback(() => setMessages([OPENING]), []);

  return { messages, busy, ask, reset };
}
