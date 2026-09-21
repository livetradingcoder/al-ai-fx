// What Server Actions return. Expected failures come back as values, not
// throws: Next.js replaces a thrown Server Function error with a generic
// message in production, so the page could never say why it failed.
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
