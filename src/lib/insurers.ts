/** Insurer logos (the full mark, with the name), served from public/insurers/. Matched on the name the API
    sends ("מנורה מבטחים ביטוח" → מנורה), as a whole word, so "כללי" is not כלל. */
const INSURERS: { name: string; logo: string }[] = [
  { name: "הפניקס", logo: "fnx.svg" },
  { name: "הראל", logo: "harel.svg" },
  { name: "מנורה", logo: "menora.png" },
  { name: "אלטשולר", logo: "altshuler.png" },
  { name: "כלל", logo: "clal.svg" },
  { name: "מגדל", logo: "migdal.svg" },
  { name: "מיטב", logo: "meitav.svg" },
  { name: "איילון", logo: "ayalon.svg" },
];

/** The companies the console knows, in display order — for pickers. */
export const INSURER_NAMES: string[] = INSURERS.map((i) => i.name);

/** The logo for text that starts with an insurer's name, or null. */
export function insurerLogo(text: string | null | undefined): string | null {
  const value = text?.trim();
  if (!value) return null;
  const hit = INSURERS.find((i) => value === i.name || value.startsWith(`${i.name} `));
  return hit ? `/insurers/${hit.logo}` : null;
}
