import { useQuery } from "@tanstack/react-query";

/*
 * A photo of the actual aircraft, by its transponder address, from
 * Planespotters.net. Their API allows browser requests and asks that each
 * photo link to its page and credit the photographer, which this does.
 */

interface PlanespottersPhoto {
  thumbnail_large?: { src: string; size: { width: number; height: number } };
  link: string;
  photographer: string;
}

async function fetchPhoto(hex: string): Promise<PlanespottersPhoto | null> {
  const response = await fetch(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(hex)}`);
  if (!response.ok) throw new Error(`Planespotters answered ${response.status}`);
  const body: { photos?: PlanespottersPhoto[] } = await response.json();
  return body.photos?.find((photo) => photo.thumbnail_large) ?? null;
}

export function AircraftPhoto({ hex, label }: { hex: string; label: string }) {
  const { data: photo } = useQuery({
    queryKey: ["aircraft-photo", hex],
    queryFn: () => fetchPhoto(hex),
    // A photo of a given airframe doesn't change during a visit.
    staleTime: Infinity,
    retry: false,
  });

  // No photo, or the service is unreachable: show nothing rather than a gap.
  if (!photo?.thumbnail_large) return null;

  return (
    <figure className="overflow-hidden rounded-md bg-black/30">
      <a href={photo.link} target="_blank" rel="noreferrer">
        <img
          src={photo.thumbnail_large.src}
          width={photo.thumbnail_large.size.width}
          height={photo.thumbnail_large.size.height}
          alt={`Photo of ${label}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[3/2] w-full object-cover"
        />
      </a>
      <figcaption className="px-3 py-2 text-xs text-board-muted">
        Photo by{" "}
        <a href={photo.link} target="_blank" rel="noreferrer" className="text-board-ink underline-offset-2 hover:underline">
          {photo.photographer}
        </a>{" "}
        on Planespotters.net
      </figcaption>
    </figure>
  );
}
