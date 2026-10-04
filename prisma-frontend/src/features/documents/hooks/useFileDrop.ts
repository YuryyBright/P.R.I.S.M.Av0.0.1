import { useState, type DragEvent } from "react";

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

/**
 * Drag-and-drop of files onto an element. Spread `dropProps` on it; `dragging` drives the overlay.
 * Reacts to files only, so dragging selected text over the panel does nothing.
 */
export function useFileDrop(
  enabled: boolean,
  onFiles: (files: File[]) => void,
) {
  const [dragging, setDragging] = useState(false);

  if (!enabled) return { dragging: false, dropProps: {} };

  const dropProps = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      // Moving over a child fires dragleave on the container: ignore it to avoid flicker.
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      onFiles(Array.from(e.dataTransfer.files));
    },
  };

  return { dragging, dropProps };
}
