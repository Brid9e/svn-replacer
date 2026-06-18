export function OutputPanel({
  type,
  text,
  onClose,
}: {
  type: string;
  text: string;
  onClose: () => void;
}) {
  return (
    <div className={`output-box ${type}`}>
      <div className="output-close" onClick={onClose}>✕</div>
      {text}
    </div>
  );
}
