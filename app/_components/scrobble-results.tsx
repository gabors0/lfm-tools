import type { ScrobbleResult } from "@/app/actions";
import { alertBox, panel } from "@/app/_components/styles";

export function ScrobbleResults({ result }: { result: ScrobbleResult }) {
  if (!result.ok) {
    return (
      <p role="alert" className={alertBox}>
        {result.error}
      </p>
    );
  }

  const { outcomes } = result;
  const accepted = outcomes.filter((outcome) => outcome.accepted);
  const ignored = outcomes.filter((outcome) => !outcome.accepted);
  const corrected = accepted.filter((outcome) => outcome.corrected);

  return (
    <div role="status" className={`${ignored.length ? alertBox : panel} text-sm`}>
      <p>
        {outcomes.length === 1
          ? accepted.length
            ? `Scrobbled “${outcomes[0].track}” by ${outcomes[0].artist}.`
            : "Last.fm did not accept this scrobble."
          : `Scrobbled ${accepted.length} of ${outcomes.length} tracks.`}
      </p>
      {ignored.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-foreground/80">
          {ignored.map((outcome) => (
            <li key={`${outcome.timestamp}-${outcome.track}`}>
              {outcomes.length > 1 && `${outcome.track}: `}
              {outcome.ignoredReason}
            </li>
          ))}
        </ul>
      )}
      {corrected.length > 0 && (
        <p className="mt-2 text-foreground/60">
          Last.fm auto-corrected{" "}
          {corrected.length === 1 && outcomes.length === 1
            ? "the artist or track name."
            : `${corrected.length} names.`}
        </p>
      )}
    </div>
  );
}
