import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export interface DialogField {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

export function SvnOperationDialog({
  open,
  title,
  fields,
  confirmDisabled,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string | React.ReactNode;
  fields: DialogField[];
  confirmDisabled?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const handleOverlayClick = useCallback(() => onCancel(), [onCancel]);
  const handleDialogClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-dialog" onClick={handleDialogClick}>
        <p className="modal-message">{title}</p>
        {fields.map((f, i) => (
          <div className="field" style={{ margin: "12px 0" }} key={i}>
            <label>{f.label}</label>
            <input
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              autoFocus={f.autoFocus}
            />
          </div>
        ))}
        <div className="modal-buttons">
          <button className="btn" onClick={onCancel}>{cancelText ?? t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={confirmDisabled}>{confirmText ?? t("common.ok")}</button>
        </div>
      </div>
    </div>
  );
}
