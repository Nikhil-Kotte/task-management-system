export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="confirm-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
        <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.5rem" }}>
          {title}
        </h3>
        <p style={{ color: "var(--ink-soft)", marginBottom: "1.25rem" }}>{message}</p>
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-outline-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
