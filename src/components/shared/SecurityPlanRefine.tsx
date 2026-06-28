"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage, SecurityPlanResponse } from "@/lib/api/security-plan";
import { securityPlanApi } from "@/lib/api/security-plan";
import { cn } from "@/lib/utils";

interface SecurityPlanRefineProps {
  instructions: string;
  plan: SecurityPlanResponse["plan"];
  slug?: string;
  disabled?: boolean;
  onPlanUpdate: (plan: SecurityPlanResponse["plan"]) => void;
}

const SUGGESTIONS = [
  "I'm worried about the back entrance — can we tighten that?",
  "We need full camera coverage, no blind spots",
  "Scale back guards a bit, keep it lighter",
  "This is a high-profile VIP — maximum security please",
];

export function SecurityPlanRefine({
  instructions,
  plan,
  slug,
  disabled,
  onPlanUpdate,
}: SecurityPlanRefineProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    try {
      const res = await securityPlanApi.chat(
        {
          message: trimmed,
          history: messages,
          instructions,
          previousPlan: plan,
        },
        slug
      );

      const history = res.history as ChatMessage[];
      setMessages(history);
      if (res.plan) {
        onPlanUpdate(res.plan);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Refine plan
      </p>

      {messages.length > 0 && (
        <ScrollArea className="h-32 rounded-md border border-border/50 bg-black/20 p-2">
          <div className="space-y-2 pr-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-[11px] leading-relaxed",
                  msg.role === "user"
                    ? "ml-4 bg-cyan-500/15 text-foreground"
                    : "mr-2 bg-purple-500/10 text-muted-foreground"
                )}
              >
                {msg.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating plan...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-border/60 px-2 py-0.5 text-[9px] text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-300"
              onClick={() => void sendMessage(s)}
              disabled={disabled || sending}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want — e.g. I'm nervous about the lobby..."
          className="h-9 text-xs"
          disabled={disabled || sending}
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled || sending || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
