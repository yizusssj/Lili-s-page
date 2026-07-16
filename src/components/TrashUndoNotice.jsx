import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { useWorkspace } from "../workspace/workspaceContext.js";

export default function TrashUndoNotice() {
  const {
    dismissTrashNotice,
    lastTrashed,
    undoLastTrash,
  } = useWorkspace();
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (!lastTrashed) return undefined;
    const timerId = window.setTimeout(dismissTrashNotice, 8000);
    return () => window.clearTimeout(timerId);
  }, [dismissTrashNotice, lastTrashed]);

  if (!lastTrashed) return null;

  async function undo() {
    if (undoing) return;
    setUndoing(true);
    const restored = await undoLastTrash();
    if (!restored) setUndoing(false);
  }

  return (
    <aside className="trashUndoNotice" role="status" aria-live="polite">
      <span>{lastTrashed.message}</span>
      <button type="button" onClick={() => void undo()} disabled={undoing}>
        <RotateCcw aria-hidden="true" size={15} />
        {undoing ? "Restaurando..." : "Deshacer"}
      </button>
      <button
        type="button"
        className="trashUndoClose"
        onClick={dismissTrashNotice}
        aria-label="Cerrar aviso"
      >
        <X aria-hidden="true" size={15} />
      </button>
    </aside>
  );
}
