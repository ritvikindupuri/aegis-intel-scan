import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Send, X, MessageSquare } from "lucide-react";
import { analyzeSurface } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiChatPanelProps {
  context: "surface" | "findings" | "raw_data";
  contextData: any;
  domain: string;
  onInsight?: (section: string, analysis: string) => void;
}

const CONTEXT_LABELS: Record<string, string> = {
  surface: "Attack Surface",
  findings: "Findings",
  raw_data: "Raw Data",
};

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  surface: [
    "What are the most critical security header gaps?",
    "Which endpoints pose the highest risk?",
    "Assess the supply chain risk from external dependencies",
    "Give me a full attack surface summary",
  ],
  findings: [
    "Summarize the most critical findings",
    "Which vulnerabilities should be patched first?",
    "What attack chains could an adversary build from these findings?",
    "Provide remediation steps for all high/critical findings",
  ],
  raw_data: [
    "Give me an executive summary of this crawl data",
    "What sensitive information is exposed in the raw data?",
    "Identify infrastructure details from this data",
    "What can an attacker learn from this raw data?",
  ],
};

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.replace('## ', '')}</h3>;
    if (line.startsWith('### ')) return <h4 key={i} className="text-xs font-bold text-foreground mt-2 mb-0.5">{line.replace('### ', '')}</h4>;
    if (line.startsWith('**') && line.endsWith('**')) return <div key={i} className="text-xs font-bold text-foreground mt-2">{line.replace(/\*\*/g, '')}</div>;
    if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} className="text-xs text-muted-foreground pl-3">• {line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')}</div>;
    if (line.match(/^\d+\.\s/)) return <div key={i} className="text-xs text-muted-foreground pl-3">{line.replace(/\*\*/g, '')}</div>;
    if (line.trim() === '') return <div key={i} className="h-1" />;
    return <div key={i} className="text-xs text-muted-foreground">{line.replace(/\*\*/g, '')}</div>;
  });
}

export function AiChatPanel({ context, contextData, domain, onInsight }: AiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    const userMsg: Message = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Map context to the right section type for the edge function
      const section = context === "surface" ? "surface_chat" : context === "findings" ? "findings_chat" : "raw_data_chat";
      const result = await analyzeSurface(section, { question, data: contextData }, domain);
      const assistantMsg: Message = { role: "assistant", content: result };
      setMessages(prev => [...prev, assistantMsg]);
      onInsight?.(context, result);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
      >
        <Sparkles className="h-3 w-3" />
        AI Analyst — {CONTEXT_LABELS[context]}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" />
          AI Threat Analyst — {CONTEXT_LABELS[context]}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-6 w-6 p-0 hover:bg-primary/10">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-80 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Ask me anything about the {CONTEXT_LABELS[context].toLowerCase()} data. Here are some suggestions:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS[context].map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-[11px] px-2.5 py-1.5 rounded-md bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="bg-primary/15 text-foreground text-xs px-3 py-2 rounded-lg max-w-[85%]">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-1 leading-relaxed">
                {renderMarkdown(msg.content)}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-primary/10 p-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask the AI analyst..."
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none px-2"
          disabled={loading}
        />
        <Button
          size="sm"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="h-7 w-7 p-0"
        >
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
