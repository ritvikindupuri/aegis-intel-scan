import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { getScans, type Scan } from "@/lib/api";
import { StatusBadge } from "@/components/SeverityBadge";
import { Globe, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";

const History = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScans().then(setScans).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Scan History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All previous reconnaissance scans</p>
      </motion.div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : scans.length === 0 ? (
        <motion.div variants={fadeInUp}>
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              No scans yet. <Link to="/scan" className="text-primary hover:underline">Start one</Link>.
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {scans.map((scan, i) => (
            <motion.div
              key={scan.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <Link to={`/scan/${scan.id}`}>
                <Card className="bg-card border-border hover:border-primary/30 transition-all duration-200 cursor-pointer card-hover">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-md bg-secondary">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
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
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default History;
