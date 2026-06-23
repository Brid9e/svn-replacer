import { useState, useCallback, useRef, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { TerminalMessage } from "../components/TerminalPanel";

export function useTerminal() {
  const msgIdRef = useRef(0);
  const [messages, setMessages] = useState<TerminalMessage[]>([]);

  const addMessage = useCallback((type: string, text: string) => {
    const id = ++msgIdRef.current;
    setMessages((prev) => [...prev, { id, type, text }]);
  }, []);

  const setOutput = useCallback((msg: { type: string; text: string } | null) => {
    if (msg) addMessage(msg.type, msg.text);
  }, [addMessage]);

  const onClear = useCallback(() => setMessages([]), []);

  // Listen for SVN progress events from Rust backend
  useEffect(() => {
    const unlisten = listen<string>("svn-progress", (event) => {
      addMessage("info", event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [addMessage]);

  return { messages, addMessage, setOutput, onClear };
}
