import { useState, useRef, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Send, X, Copy, Check } from "lucide-react";
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

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, j) =>
    j % 2 === 1
      ? <span key={j} className="font-semibold text-foreground">{part}</span>
      : <span key={j}>{part}</span>
  );
}

function parseTableBlock(lines: string[], startIndex: number): { element: ReactNode; endIndex: number } | null {
  // Check if this line and the next form a markdown table
  if (startIndex + 1 >= lines.length) return null;
  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];
  
  if (!headerLine.includes('|') || !separatorLine.match(/^\|?[\s-:|]+\|/)) return null;

  const parseRow = (row: string) =>
    row.split('|').map(c => c.trim()).filter(c => c.length > 0);

  const headers = parseRow(headerLine);
  const rows: string[][] = [];
  let endIdx = startIndex + 2;

  while (endIdx < lines.length && lines[endIdx].includes('|') && !lines[endIdx].startsWith('#')) {
    rows.push(parseRow(lines[endIdx]));
    endIdx++;
  }

  const element = (
    <div key={`table-${startIndex}`} className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/50 border-b border-border">
            {headers.map((h, j) => (
              <th key={j} className="text-left py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                {h.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 hover:bg-secondary/20">
              {row.map((cell, ci) => (
                <td key={ci} className="py-1.5 px-3 text-muted-foreground">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return { element, endIndex: endIdx - 1 };
}

export function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Try table
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s-:|]+\|/)) {
      const table = parseTableBlock(lines, i);
      if (table) {
        elements.push(table.element);
        i = table.endIndex + 1;
        continue;
      }
    }

    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/30">{line.replace('## ', '')}</h3>);
    } else if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-xs font-bold text-foreground mt-4 mb-1">{line.replace('### ', '')}</h4>);
    } else if (line.startsWith('#### ')) {
      elements.push(<h5 key={i} className="text-xs font-semibold text-foreground mt-3 mb-0.5">{line.replace('#### ', '')}</h5>);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<div key={i} className="text-xs font-bold text-foreground mt-3 mb-1">{line.replace(/\*\*/g, '')}</div>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.replace(/^[-*]\s*/, '');
      elements.push(
        <div key={i} className="text-xs text-muted-foreground pl-4 py-0.5 flex gap-1.5">
          <span className="text-primary shrink-0">•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    } else if (line.match(/^\s+[-*]\s/)) {
      const content = line.replace(/^\s+[-*]\s*/, '');
      elements.push(
        <div key={i} className="text-xs text-muted-foreground pl-8 py-0.5 flex gap-1.5">
          <span className="text-muted-foreground/50 shrink-0">◦</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(<div key={i} className="text-xs text-muted-foreground pl-4 py-0.5">{renderInline(line)}</div>);
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="border-border my-3" />);
    } else if (line.startsWith('> ')) {
      elements.push(
        <div key={i} className="text-xs text-muted-foreground pl-3 py-1 border-l-2 border-primary/30 ml-1 italic">
          {renderInline(line.replace(/^>\s*/, ''))}
        </div>
      );
    } else if (line.startsWith('```')) {
      // Code block - collect until closing ```
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} className="text-[11px] font-mono bg-secondary/50 rounded-md p-3 my-2 overflow-x-auto text-muted-foreground border border-border/30">
          {codeLines.join('\n')}
        </pre>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<div key={i} className="text-xs text-muted-foreground leading-relaxed">{renderInline(line)}</div>);
    }

    i++;
  }

  return elements;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary/60"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
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
      <div ref={scrollRef} className="max-h-[28rem] overflow-y-auto p-3 space-y-3">
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
              <div className="space-y-0.5 leading-relaxed">
                {renderMarkdown(msg.content)}
                <div className="flex justify-end pt-1">
                  <CopyButton text={msg.content} />
                </div>
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
