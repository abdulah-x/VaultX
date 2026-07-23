"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Bot, User, Loader2, RotateCcw, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

interface Message {
 id: string;
 role: "user" | "assistant";
 content: string;
 timestamp: Date;
 isError?: boolean;
}

const STARTER_PROMPTS = [
 "What's my current portfolio risk level?",
 "Which asset has the best performance this month?",
 "Should I rebalance my portfolio?",
 "What's my Sharpe ratio and what does it mean?",
];

function MessageBubble({ message }: { message: Message }) {
 const isUser = message.role === "user";
 return (
 <motion.div
 initial={{ opacity: 0, x: isUser ? 24 : -24, y: 8 }}
 animate={{ opacity: 1, x: 0, y: 0 }}
 transition={{ type: "spring", stiffness: 380, damping: 28 }}
 className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
 >
 {/* Avatar */}
 <div
 className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
 isUser
 ? "bg-primary"
 : "bg-primary"
 }`}
 >
 {isUser ? (
 <User className="w-4 h-4 text-foreground" />
 ) : (
 <Bot className="w-4 h-4 text-foreground" />
 )}
 </div>

 {/* Bubble */}
 <div
 className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
 isUser
 ? "bg-primary text-foreground rounded-tr-sm"
 : message.isError
 ? "bg-vaultx-danger/40 border border-vaultx-danger/50 text-vaultx-danger rounded-tl-sm"
 : "bg-secondary text-foreground rounded-tl-sm border border-border"
 }`}
 >
 {/* Render simple markdown: bold and line breaks */}
 <span
 dangerouslySetInnerHTML={{
 __html: message.content
 .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
 .replace(/\n/g, "<br/>")
 .replace(/•/g, "• "),
 }}
 />
 <div
 className={`mt-1.5 text-[10px] ${
 isUser ? "text-primary text-right" : "text-muted-foreground"
 }`}
 >
 {message.timestamp.toLocaleTimeString([], {
 hour: "2-digit",
 minute: "2-digit",
 })}
 </div>
 </div>
 </motion.div>
 );
}

function TypingIndicator() {
 return (
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 4 }}
 transition={{ duration: 0.2 }}
 className="flex gap-3"
 >
 <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
 <Bot className="w-4 h-4 text-foreground" />
 </div>
 <div className="bg-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-3">
 <div className="flex gap-1.5 items-center h-5">
 <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
 <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
 <div className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
 </div>
 </div>
 </motion.div>
 );
}

export default function AdvisorChat() {
 const [messages, setMessages] = useState<Message[]>([
 {
 id: "welcome",
 role: "assistant",
 content:
 "Hi! I'm your **VaultX AI Portfolio Advisor**, powered by Gemini. I have access to your real holdings, P&L, and portfolio performance.\n\nAsk me anything about your crypto portfolio — risk analysis, rebalancing suggestions, performance insights, and more.",
 timestamp: new Date(),
 },
 ]);
 const [input, setInput] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const bottomRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 bottomRef.current?.scrollIntoView({ behavior: "smooth" });
 }, [messages, isLoading]);

 const sendMessage = async (text: string) => {
 const trimmed = text.trim();
 if (!trimmed || isLoading) return;

 const userMsg: Message = {
 id: `user-${Date.now()}`,
 role: "user",
 content: trimmed,
 timestamp: new Date(),
 };

 setMessages((prev) => [...prev, userMsg]);
 setInput("");
 setIsLoading(true);

 try {
 const response = await api.advisor.chat(trimmed);
 const answer =
 response?.answer ||
 response?.message ||
 response?.response ||
 "I couldn't generate a response. Please try again.";

 setMessages((prev) => [
 ...prev,
 {
 id: `ai-${Date.now()}`,
 role: "assistant",
 content: answer,
 timestamp: new Date(),
 },
 ]);
 } catch (err: any) {
 const isBackendDown =
 err?.message?.includes("Network Error") ||
 err?.message?.includes("ERR_CONNECTION_REFUSED") ||
 err?.response?.status === 502 ||
 err?.response?.status === 503;

 setMessages((prev) => [
 ...prev,
 {
 id: `err-${Date.now()}`,
 role: "assistant",
 content: isBackendDown
 ? "⚠️ Cannot connect to the backend. Make sure the Docker stack is running (`docker compose up`)."
 : err?.response?.data?.detail ||
 "Something went wrong. Please try again.",
 timestamp: new Date(),
 isError: true,
 },
 ]);
 } finally {
 setIsLoading(false);
 inputRef.current?.focus();
 }
 };

 const handleReset = () => {
 setMessages([
 {
 id: "welcome-reset",
 role: "assistant",
 content:
 "Conversation cleared. What would you like to know about your portfolio?",
 timestamp: new Date(),
 },
 ]);
 };

 return (
 <div className="flex flex-col h-full">
 {/* Chat Header */}
 <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-purple-500/20">
 <Sparkles className="w-5 h-5 text-foreground" />
 </div>
 <div>
 <h2 className="text-foreground font-semibold">AI Portfolio Advisor</h2>
 <p className="text-xs text-muted-foreground">Powered by Gemini · Uses your real portfolio data</p>
 </div>
 </div>
 <button
 onClick={handleReset}
 title="Clear conversation"
 className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 </div>

 {/* Disclaimer banner */}
 <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-vaultx-warning/20 border border-vaultx-warning/30 flex items-start gap-2">
 <Info className="w-3.5 h-3.5 text-vaultx-warning shrink-0 mt-0.5" />
 <p className="text-xs text-vaultx-warning">
 AI responses are for informational purposes only, not financial advice.
 </p>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
 {messages.map((msg) => (
 <MessageBubble key={msg.id} message={msg} />
 ))}
 {isLoading && <TypingIndicator />}
 <div ref={bottomRef} />
 </div>

 {/* Starter prompts — shown until user sends first message */}
 <AnimatePresence>
 {messages.length === 1 && (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 8 }}
 transition={{ duration: 0.2 }}
 className="px-6 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
 >
 {STARTER_PROMPTS.map((prompt, i) => (
 <motion.button
 key={prompt}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.06 }}
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => sendMessage(prompt)}
 className="text-left text-xs px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground hover:border-primary/40 hover:text-foreground hover:bg-secondary transition-colors"
 >
 {prompt}
 </motion.button>
 ))}
 </motion.div>
 )}
 </AnimatePresence>

 {/* Input */}
 <div className="px-6 pb-6 pt-3">
 <form
 onSubmit={(e) => {
 e.preventDefault();
 sendMessage(input);
 }}
 className="flex gap-3 items-center bg-secondary border border-border rounded-xl px-4 py-3 focus-within:border-primary/40 transition-colors"
 >
 <input
 ref={inputRef}
 type="text"
 value={input}
 onChange={(e) => setInput(e.target.value)}
 placeholder="Ask about your portfolio..."
 disabled={isLoading}
 className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
 />
 <button
 type="submit"
 disabled={!input.trim() || isLoading}
 className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary transition-colors shrink-0"
 >
 {isLoading ? (
 <Loader2 className="w-4 h-4 text-foreground animate-spin" />
 ) : (
 <Send className="w-4 h-4 text-foreground" />
 )}
 </button>
 </form>
 </div>
 </div>
 );
}
