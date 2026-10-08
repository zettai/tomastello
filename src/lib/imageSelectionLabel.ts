/** Accessible name for the admin checkbox that toggles a photo on the public home page. */
export function homePageImageCheckboxLabel(imageKey: string): string {
  const segment = imageKey.split("/").pop();
  const name = segment && segment.length > 0 ? segment : "photo";
  return `Show ${name} on the home page`;
}
