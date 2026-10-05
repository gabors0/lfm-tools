// Browser-only helpers for saving generated files.

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Today's date as YYYY-MM-DD, for file names. */
export function fileDate() {
  return new Date().toISOString().slice(0, 10);
}
