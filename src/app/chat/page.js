"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MaterialSymbol from "@/components/MaterialSymbol";

const INITIAL_MESSAGES = [
  { id: 1, from: "opponent", sender: "Cloud9 Academy", text: "Hey, what's the lobby code?",     time: "10:42 AM" },
  { id: 2, from: "user",     sender: "Rocket Rams (You)", text: "lobby name: rams_scrim, pass: 1234", time: "10:45 AM" },
  { id: 3, from: "opponent", sender: "Cloud9 Academy", text: "Got it, we're joining now.",       time: "10:46 AM" },
  { id: 4, type: "event",    text: "Rocket Rams updated the roster." },
  { id: 5, from: "user",     sender: "Rocket Rams (You)", text: "All 5 are in. Ready when you are 🎯", time: "10:49 AM" },
  { id: 6, from: "opponent", sender: "Cloud9 Academy", text: "GG we'll be there in 2. Good luck!", time: "10:51 AM" },
];

const AUTO_REPLIES = [
  "👍 Got it!",
  "See you in lobby!",
  "We're ready, let's run it.",
  "GG, good luck!",
  "Our IGL is subbing in, one sec.",
  "Can we do Bind instead?",
];

let nextId = 100;

export default function ChatPage() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newMsg = {
      id: nextId++,
      from: "user",
      sender: "Rocket Rams (You)",
      text,
      time,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        { id: nextId++, from: "opponent", sender: "Cloud9 Academy", text: reply, time: replyTime },
      ]);
    }, 1500);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-white/80 backdrop-blur-md top-0 sticky z-50 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border-b border-slate-200/50 flex justify-between items-center w-full px-5 h-14">
        <Link
          href="/detail"
          className="text-primary hover:bg-surface-container transition-colors active:scale-95 p-2 -ml-2 rounded-full flex items-center justify-center"
        >
          <MaterialSymbol>arrow_back_ios_new</MaterialSymbol>
        </Link>
        <div className="flex flex-col items-center justify-center flex-1">
          <h1 className="text-lg font-black tracking-tighter text-on-surface leading-tight">Scrim Chat</h1>
          <span className="font-label-small text-label-small text-on-surface-variant">
            Rocket Rams vs Cloud9 Academy
          </span>
        </div>
        <button className="text-primary hover:bg-surface-container transition-colors active:scale-95 p-2 -mr-2 rounded-full flex items-center justify-center">
          <MaterialSymbol>info</MaterialSymbol>
        </button>
      </header>

      {/* Chat Canvas */}
      <main className="flex-1 overflow-y-auto px-margin-mobile pt-lg pb-36 flex flex-col gap-lg max-w-[1200px] w-full mx-auto">
        {/* Date Separator */}
        <div className="flex items-center justify-center w-full mt-sm">
          <div className="bg-surface-container-highest text-on-surface-variant font-label-small text-label-small px-3 py-1 rounded-full">
            Today
          </div>
        </div>

        {messages.map((msg) => {
          if (msg.type === "event") {
            return (
              <div key={msg.id} className="flex items-center justify-center w-full my-md">
                <div className="flex items-center gap-2 bg-surface-container-low text-on-surface-variant font-label-small text-label-small px-4 py-2 rounded-full border border-outline-variant/30">
                  <MaterialSymbol className="text-[16px]">group_add</MaterialSymbol>
                  {msg.text}
                </div>
              </div>
            );
          }

          const isUser = msg.from === "user";
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col gap-xs max-w-[80%] md:max-w-[60%] ${isUser ? "items-end" : ""}`}>
                <span className={`font-label-small text-label-small text-on-surface-variant ${isUser ? "mr-2" : "ml-2"}`}>
                  {msg.sender}
                </span>
                <div
                  className={`font-body-main text-body-main px-md py-sm ${
                    isUser
                      ? "bg-primary text-on-primary rounded-2xl rounded-tr-sm shadow-[0_2px_10px_rgba(0,112,235,0.15)]"
                      : "bg-surface-container text-on-surface rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                  }`}
                >
                  {msg.text}
                </div>
                {isUser ? (
                  <div className="flex items-center gap-1 mr-2">
                    <span className="font-label-small text-[10px] text-outline">{msg.time}</span>
                    <MaterialSymbol className="text-[14px] text-primary">done_all</MaterialSymbol>
                  </div>
                ) : (
                  <span className="font-label-small text-[10px] text-outline ml-2">{msg.time}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex w-full justify-start">
            <div className="flex flex-col gap-xs max-w-[80%]">
              <span className="font-label-small text-label-small text-on-surface-variant ml-2">Cloud9 Academy</span>
              <div className="bg-surface-container text-on-surface-variant px-md py-sm rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex gap-1 items-center">
                <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 w-full bg-surface-container-lowest/95 backdrop-blur-xl border-t border-surface-container-highest z-40 shadow-[0_-4px_20px_0_rgba(0,0,0,0.03)]" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)" }}>
        <div className="max-w-[1200px] mx-auto px-margin-mobile py-sm flex items-center gap-sm">
          <button className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-outline hover:text-primary hover:bg-primary/10 transition-colors active:scale-95">
            <MaterialSymbol>add</MaterialSymbol>
          </button>
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              className="w-full bg-surface-container text-on-surface font-body-main text-body-main rounded-full py-3 pl-4 pr-12 border-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline outline-none"
              placeholder="Type a message..."
              type="text"
            />
          </div>
          <button
            onClick={sendMessage}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-primary text-on-primary hover:bg-surface-tint shadow-sm transition-all active:scale-95"
          >
            <MaterialSymbol className="text-[20px]" fill>send</MaterialSymbol>
          </button>
        </div>
      </div>
    </div>
  );
}
