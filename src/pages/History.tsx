import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getScans, type Scan } from "@/lib/api";
import { StatusBadge } from "@/components/SeverityBadge";
import { Globe, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const History = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScans().then(setScans).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Scan History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All previous reconnaissance scans</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : scans.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            No scans yet. <Link to="/scan" className="text-primary hover:underline">Start one</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {scans.map(scan => (
            <Link key={scan.id} to={`/scan/${scan.id}`}>
              <Card className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-mono text-sm truncate">{scan.domain}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · {scan.urls_found} URLs · {scan.vulnerabilities_found} findings
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={scan.status} />
                    {scan.status === 'completed' && (
                      <span className={`font-mono text-sm font-bold ${
                        scan.risk_score >= 75 ? "text-severity-critical" :
                        scan.risk_score >= 50 ? "text-severity-high" :
                        scan.risk_score >= 25 ? "text-severity-medium" : "text-severity-low"
                      }`}>{scan.risk_score}</span>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
