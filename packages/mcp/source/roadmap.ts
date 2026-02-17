export const ROADMAP_ID_REGEX = /^ROADMAP-\d{4}$/;

export function isValidRoadmapId(id: string): boolean {
  return ROADMAP_ID_REGEX.test(id);
}
