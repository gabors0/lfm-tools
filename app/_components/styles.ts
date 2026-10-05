const gradientButton =
  "flex items-center justify-center gap-2 rounded-sm bg-linear-to-b from-lastfm-start to-lastfm-end font-medium text-white transition-[filter] hover:brightness-115 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

export const primaryButton = `${gradientButton} px-5 py-2.5`;

export const smallPrimaryButton = `${gradientButton} px-3 py-1.5 text-sm`;

export const secondaryButton =
  "rounded-sm border border-border px-4 py-2 text-sm transition-colors hover:border-lastfm-start hover:text-lastfm-start disabled:pointer-events-none disabled:opacity-50";

export const textInput =
  "w-full rounded-sm border border-border bg-surface/40 px-3 py-2 outline-none transition-colors placeholder:text-foreground/40 focus:border-lastfm-start";

export const alertBox =
  "rounded-md border border-lastfm-start/40 bg-lastfm-start/10 p-4";

export const panel = "rounded-md border border-border bg-surface/50 p-4";

/** One option in a row of joined toggle buttons (like the sort selector). */
export function segment(active: boolean) {
  return `border px-3 py-1 transition-colors first:rounded-l-sm last:rounded-r-sm ${
    active
      ? "border-lastfm-start text-lastfm-start"
      : "border-border text-foreground/60 hover:text-lastfm-start"
  }`;
}
