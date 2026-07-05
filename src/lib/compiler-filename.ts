/**
 * Compiled EA filename generation. Used by BOTH /api/compiler/complete
 * (write path — becomes the Blob pathname) AND /api/compiler/download
 * (read path — becomes Content-Disposition filename).
 *
 * Phase 3: single-robot. The default slug is the canonical lowercase DB
 * Robot.slug ("goldbot") so compiled filenames and Blob source paths stay
 * consistent with the database. Phase 4 will thread the real per-robot slug
 * through opts.robotSlug.
 */
export function getCompiledFilename(jobId: string, opts?: { robotSlug?: string }): string {
  const slug = opts?.robotSlug ?? "goldbot";
  return `AL-ai-FX_${slug}_${jobId}.ex5`;
}

/** Blob pathname (prefix + filename). */
export function getCompiledBlobPathname(jobId: string, opts?: { robotSlug?: string }): string {
  return `compiled/${getCompiledFilename(jobId, opts)}`;
}
