import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { analyzeSurface } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AiSurfaceInsightProps {
  section: "security_headers" | "endpoints" | "dependencies";
  data: any;
  domain: string;
  onAnalysis?: (section: string, analysis: string) => void;
}

export function AiSurfaceInsight({ section, data, domain, onAnalysis }: AiSurfaceInsightProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analyzeSurface(section, data, domain);
      setAnalysis(result);
      onAnalysis?.(section, result);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sectionLabel = section === "security_headers" ? "Security Headers" : section === "endpoints" ? "Endpoints" : "Dependencies";

  if (analysis) {
    return (
      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" />
          AI Threat Analysis
        </div>
        <div className="text-sm leading-relaxed space-y-1.5">
          {analysis.split('\n').map((line, i) => {
            if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.replace('## ', '')}</h3>;
            if (line.startsWith('### ')) return <h4 key={i} className="text-xs font-bold text-foreground mt-2 mb-0.5">{line.replace('### ', '')}</h4>;
            if (line.startsWith('**') && line.endsWith('**')) return <div key={i} className="text-xs font-bold text-foreground mt-2">{line.replace(/\*\*/g, '')}</div>;
            if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} className="text-xs text-muted-foreground pl-3">• {line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')}</div>;
            if (line.match(/^\d+\.\s/)) return <div key={i} className="text-xs text-muted-foreground pl-3">{line.replace(/\*\*/g, '')}</div>;
            if (line.trim() === '') return <div key={i} className="h-1" />;
            return <div key={i} className="text-xs text-muted-foreground">{line.replace(/\*\*/g, '')}</div>;
          })}
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAnalyze}
      disabled={loading}
      className="mt-3 gap-1.5 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {loading ? `Analyzing ${sectionLabel}...` : `AI Analysis`}
    </Button>
  );
}
