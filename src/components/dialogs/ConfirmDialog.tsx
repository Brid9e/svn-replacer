import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}) {
  const { t } = useTranslation();
  const handleOverlayClick = useCallback(() => onCancel(), [onCancel]);
  const handleDialogClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-dialog" onClick={handleDialogClick}>
        <p className="modal-message">{message}</p>
        <div className="modal-buttons">
          <button className="btn" onClick={onCancel}>{cancelText ?? t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={onConfirm}>{confirmText ?? t("common.ok")}</button>
        </div>
      </div>
    </div>
  );
}
