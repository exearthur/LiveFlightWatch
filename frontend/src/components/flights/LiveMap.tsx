import "maplibre-gl/dist/maplibre-gl.css";

import { IconPlane } from "@tabler/icons-react";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { greatCircle, type LngLat } from "@/lib/position";
import type { AirportLocation } from "@/types/flight";
// MapLibre looks for its worker next to its own module, which no longer
// holds once Vite has bundled that module. Vite bundles the worker too, and
// this is its address.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);

/*
 * The live map: the route as a great circle between the two airports, and the
 * aircraft at its reported position, pointing along its track. MapLibre and
 * the free OpenFreeMap tiles (OpenStreetMap data) are only loaded when a map
 * is shown; this module is imported lazily for that reason.
 */

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const ROUTE_SOURCE = "route";

interface LiveMapProps {
  aircraft: { lat: number; lon: number; track_deg: number | null; callsign: string };
  origin: AirportLocation | undefined;
  destination: AirportLocation | undefined;
}

function airportMarker(airport: AirportLocation): HTMLElement {
  const element = document.createElement("div");
  element.className =
    "rounded-[3px] bg-board px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-board-ink ring-1 ring-board-line";
  element.textContent = airport.iata;
  element.title = airport.name ?? airport.iata;
  return element;
}

export default function LiveMap({ aircraft, origin, destination }: LiveMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const planeMarker = useRef<maplibregl.Marker | null>(null);
  const planeRoot = useRef<Root | null>(null);
  const position: LngLat = [aircraft.lon, aircraft.lat];

  // Build the map once, with the route and airports, framed on the trip.
  useEffect(() => {
    if (!container.current) return;
    const route =
      origin && destination ? greatCircle([origin.lon, origin.lat], [destination.lon, destination.lat]) : [];

    const instance = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: position,
      zoom: 4,
      attributionControl: { compact: true },
      // A wheel over the map would otherwise zoom it instead of scrolling the drawer.
      cooperativeGestures: true,
    });
    map.current = instance;

    instance.on("load", () => {
      // On a narrow map the expanded credits cover the route, so they start
      // folded behind their "i" button, which OpenStreetMap's guidelines allow.
      if ((container.current?.clientWidth ?? 0) < 480) {
        container.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
      }
      if (route.length > 1) {
        instance.addSource(ROUTE_SOURCE, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } },
        });
        instance.addLayer({
          id: ROUTE_SOURCE,
          type: "line",
          source: ROUTE_SOURCE,
          paint: { "line-color": "#f5b83d", "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 2] },
        });
      }
    });

    for (const airport of [origin, destination]) {
      if (airport) {
        new maplibregl.Marker({ element: airportMarker(airport) }).setLngLat([airport.lon, airport.lat]).addTo(instance);
      }
    }

    const bounds = new maplibregl.LngLatBounds(position, position);
    for (const point of route) bounds.extend(point);
    instance.fitBounds(bounds, { padding: 48, maxZoom: 7, duration: 0 });

    // The aircraft: a React icon rendered into the marker's element.
    const element = document.createElement("div");
    planeRoot.current = createRoot(element);
    planeMarker.current = new maplibregl.Marker({ element, rotationAlignment: "map" })
      .setLngLat(position)
      .addTo(instance);

    return () => {
      // Unmount after this render pass; unmounting a root during one warns.
      const root = planeRoot.current;
      queueMicrotask(() => root?.unmount());
      instance.remove();
      map.current = null;
      planeMarker.current = null;
      planeRoot.current = null;
    };
    // The map is built once per route; position updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.iata, destination?.iata]);

  // Move and turn the aircraft when a new position arrives.
  useEffect(() => {
    planeMarker.current?.setLngLat(position);
    // Tabler's plane icon points east, so north is 90 degrees back.
    planeMarker.current?.setRotation((aircraft.track_deg ?? 90) - 90);
    planeRoot.current?.render(
      <span
        aria-label={`${aircraft.callsign}'s position`}
        className="flex size-9 items-center justify-center rounded-full bg-board/80 ring-1 ring-board-amber/70"
      >
        <IconPlane className="size-6 text-board-amber" fill="currentColor" stroke={1} />
      </span>,
    );
    // The route is in the list because a new route builds a new marker;
    // `position` is a new array each render, so its parts are listed instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft.lat, aircraft.lon, aircraft.track_deg, aircraft.callsign, origin?.iata, destination?.iata]);

  return <div ref={container} className="h-full min-h-72 w-full overflow-hidden rounded-md" />;
}
