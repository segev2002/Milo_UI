import type { Report } from "../types";
import { StatusPill } from "./ui";

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-ink-900">{report.title}</h3>
        <StatusPill status={report.status} />
      </div>

      <div className="space-y-5 px-4 py-4">
        {report.summary && <p className="text-sm leading-relaxed text-body">{report.summary}</p>}

        {report.sections.map((section, index) => (
          <section key={index} className="space-y-2">
            {section.title && (
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {section.title}
              </h4>
            )}
            {section.lines.length > 0 && (
              <ul className="space-y-1.5">
                {section.lines.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-body">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.table && (
              <div className="space-y-1.5">
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        {section.table.headers.map((header) => (
                          <th
                            key={header}
                            scope="col"
                            className="border-b border-line pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, r) => (
                        <tr key={r} className="align-top">
                          {row.map((cell, c) => (
                            <td
                              key={c}
                              className={`border-b border-line/70 py-2.5 pr-4 ${
                                c === 0 ? "font-medium text-ink-900" : "text-body"
                              }`}
                            >
                              {cell || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {section.table.caption && (
                  <p className="text-xs italic text-muted">{section.table.caption}</p>
                )}
              </div>
            )}
          </section>
        ))}

        {report.missing_information.length > 0 && (
          <Callout tone="warm" title="Missing information">
            {report.missing_information}
          </Callout>
        )}
        {report.awaiting.length > 0 && (
          <Callout tone="ink" title="Waiting on">
            {report.awaiting}
          </Callout>
        )}
        {report.footnotes.length > 0 && (
          <div className="space-y-1 border-t border-line pt-3">
            {report.footnotes.map((note, i) => (
              <p key={i} className="text-xs italic text-muted">
                {note}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Callout({
  title,
  children,
  tone,
}: {
  title: string;
  children: string[];
  tone: "warm" | "ink" | "red";
}) {
  const tones = {
    warm: "border-champagne-deep bg-champagne-soft",
    ink: "border-ink-100 bg-ink-50",
    red: "border-[#f3d3d0] bg-[#fbeceb]",
  };
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {children.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-body">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
