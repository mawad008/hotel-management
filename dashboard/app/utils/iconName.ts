// Legacy facility identifiers are preserved in the API. Map them to the
// closest bundled Keenicon so older records still render correctly.
const ICON_ALIASES: Record<string, string> = {
  "air-conditioning": "thermometer",
  bed: "home-2",
  bell: "notification",
  building: "office-bag",
  close: "cross",
  elevator: "up-down",
  gym: "pulse",
  parking: "car",
  pool: "ocean",
  restaurant: "shop",
  security: "security-user",
  service: "parcel",
  settings: "setting",
  spa: "drop",
  tv: "screen",
  "washing-machine": "setting",
};

export function iconName(name: string): string {
  const suffix = name.startsWith("ki-") ? name.slice(3) : name;

  return ICON_ALIASES[suffix] ?? suffix;
}
