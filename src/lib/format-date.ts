// Dates in client components that are also rendered on the server. The server
// and the visitor's browser disagree on locale and time zone, so a bare
// toLocaleDateString() prints one thing in the HTML and another once React
// takes over (a hydration mismatch). These always print the same text.

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string | Date): string {
  const d = new Date(value);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${formatDate(d)}, ${time} UTC`;
}
