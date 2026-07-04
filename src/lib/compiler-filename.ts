/**
 * Compiled EA filename generation. Used by BOTH /api/compiler/complete
 * (write path — becomes the Blob pathname) AND /api/compiler/download
 * (read path — becomes Content-Disposition filename).
 *
 * Phase 1: single-robot (GoldBot). Phase 4 will thread robotSlug through.
 */
export function getCompiledFilename(jobId: string, opts?: { robotSlug?: string }): string {
  const slug = opts?.robotSlug ?? "GoldBot";
  return `AL-ai-FX_${slug}_${jobId}.ex5`;
}

/** Blob pathname (prefix + filename). */
export function getCompiledBlobPathname(jobId: string, opts?: { robotSlug?: string }): string {
  return `compiled/${getCompiledFilename(jobId, opts)}`;
}
