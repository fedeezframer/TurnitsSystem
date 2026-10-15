import type { StyleSpecification } from "maplibre-gl";
export const STREET_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// Only real street geometry and street names: no POIs, terrain or place labels.
export function streetMapStyle(
  sourceUrl = "https://tiles.openfreemap.org/planet",
): StyleSpecification {
  const roads = [
    "match",
    ["get", "class"],
    [
      "motorway",
      "trunk",
      "primary",
      "secondary",
      "tertiary",
      "minor",
      "service",
      "track",
      "path",
    ],
    true,
    false,
  ] as any;
  return {
    version: 8,
    name: "Turnits · Calles",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      streets: {
        type: "vector",
        url: sourceUrl,
        attribution: STREET_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "paper",
        type: "background",
        paint: { "background-color": "#e4e7e4" },
      },
      {
        id: "street-edges",
        type: "line",
        source: "streets",
        "source-layer": "transportation",
        filter: roads,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#d6dad6",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            1,
            13,
            4,
            16,
            14,
            19,
            34,
          ],
        },
      },
      {
        id: "streets",
        type: "line",
        source: "streets",
        "source-layer": "transportation",
        filter: roads,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            0.6,
            13,
            2.5,
            16,
            11,
            19,
            30,
          ],
        },
      },
      {
        id: "avenues",
        type: "line",
        source: "streets",
        "source-layer": "transportation",
        filter: [
          "match",
          ["get", "class"],
          ["motorway", "trunk", "primary", "secondary", "tertiary"],
          true,
          false,
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            1,
            13,
            5,
            16,
            18,
            19,
            44,
          ],
        },
      },
      {
        id: "street-names",
        type: "symbol",
        source: "streets",
        "source-layer": "transportation_name",
        minzoom: 12,
        filter: ["all", roads, ["has", "name"]],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 180,
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            11,
            16,
            13,
            19,
            15,
          ],
          "text-max-angle": 30,
          "text-padding": 5,
        },
        paint: {
          "text-color": "#7b847f",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      },
    ],
  };
}
