import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface TerminalMessage {
  id: number;
  type: string; // "success" | "error"
  text: string;
}

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 600;

export function TerminalPanel({ messages, onClear }: { messages: TerminalMessage[]; onClear: () => void }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const resizing = useRef(false);

  const [height, setHeight] = useState(() => {
    const saved = localStorage.getItem("terminalHeight");
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_HEIGHT), MAX_HEIGHT) : 80;
  });

  useEffect(() => {
    localStorage.setItem("terminalHeight", String(height));
  }, [height]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctx]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      setHeight(Math.min(Math.max(startH + (startY - ev.clientY), MIN_HEIGHT), MAX_HEIGHT));
    };
    const onUp = () => {
      resizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="terminal" style={{ height }} onContextMenu={handleContextMenu}>
      <div className="terminal-resize-handle" onMouseDown={onHandleMouseDown} />
      <div className="terminal-header">{t("terminal.title")}</div>
      <div className="terminal-body" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="terminal-empty">{t("terminal.noMessages")}</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`terminal-line terminal-${m.type}`}>
              {m.text}
            </div>
          ))
        )}
      </div>

      {ctx && (
        <div className="ctx-menu" style={{ position: "fixed", left: ctx.x, top: ctx.y, zIndex: 9999 }}>
          <div className="ctx-menu-item" onMouseDown={() => { onClear(); setCtx(null); }}>
            {t("terminal.clear")}
          </div>
        </div>
      )}
    </div>
  );
}
