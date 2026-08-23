/**
 * Saves/shares a Blob on iOS Safari (where an installed PWA has no
 * filesystem access): prefer the Web Share API with a File attachment
 * (surfaces the native "Save to Files" sheet), falling back to a plain
 * download link for browsers/desktops without file sharing.
 */
export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // user cancelled
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
}
