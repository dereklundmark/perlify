/**
 * Saves/shares a Blob on iOS Safari (where an installed PWA has no
 * filesystem access): prefer the Web Share API with a File attachment
 * (surfaces the native "Save to Files" sheet), falling back to a plain
 * download link for browsers/desktops without file sharing.
 *
 * Resolves false only when the user dismissed the share sheet without saving
 * anything — callers that record "this was saved" (e.g. the backup date)
 * must not count that.
 */
export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return false; // user cancelled
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
