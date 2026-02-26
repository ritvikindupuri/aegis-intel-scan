import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Filter, Loader2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { searchElastic, type ElasticSearchResult } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ElasticSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [aggregations, setAggregations] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const doSearch = useCallback(async (q: string, severity?: string, category?: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      setAggregations(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (severity) filters.severity = severity;
      if (category) filters.category = category;

      const data = await searchElastic(q, {
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        size: 15,
        aggs: ["severity", "category"],
      });

      setResults(data.hits);
      setTotal(data.total);
      setAggregations(data.aggregations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(value, severityFilter, categoryFilter);
    }, 300);
  };

  const handleFilterChange = (type: "severity" | "category", value: string) => {
    const val = value === "all" ? "" : value;
    if (type === "severity") {
      setSeverityFilter(val);
      doSearch(query, val, categoryFilter);
    } else {
      setCategoryFilter(val);
      doSearch(query, severityFilter, val);
    }
  };

  const handleResultClick = (result: ElasticSearchResult) => {
    const scanId = result.source.scan_id || result.id;
    navigate(`/scan/${scanId}`);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-muted-foreground text-sm hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Search findings...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border">
          ⌘K
        </kbd>
      </button>

      {/* Search overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-0 right-0 w-[420px] md:w-[520px] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Search findings, domains, CVEs..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto p-0 text-sm"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => { setOpen(false); setQuery(""); setResults([]); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Filters */}
            {query && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={severityFilter || "all"} onValueChange={(v) => handleFilterChange("severity", v)}>
                  <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs bg-transparent border-border">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severity</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
                {aggregations?.category_counts && (
                  <Select value={categoryFilter || "all"} onValueChange={(v) => handleFilterChange("category", v)}>
                    <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs bg-transparent border-border">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {aggregations.category_counts.buckets?.map((b: any) => (
                        <SelectItem key={b.key} value={b.key}>{b.key} ({b.doc_count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto">
              {error && (
                <div className="px-4 py-6 text-center text-sm text-destructive">{error}</div>
              )}

              {!error && query && !loading && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found for "{query}"
                </div>
              )}

              {!error && results.length > 0 && (
                <>
                  <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {total} result{total !== 1 ? "s" : ""} found
                  </div>
                  {results.map((hit) => (
                    <button
                      key={hit.id}
                      onClick={() => handleResultClick(hit)}
                      className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {hit.source.severity && (
                              <SeverityBadge severity={hit.source.severity} />
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {hit.source.domain}
                            </span>
                          </div>
                          <p
                            className="text-sm font-medium text-foreground truncate"
                            dangerouslySetInnerHTML={{
                              __html: hit.highlight?.title?.[0] || hit.source.title || hit.source.domain,
                            }}
                          />
                          {(hit.highlight?.description?.[0] || hit.source.description) && (
                            <p
                              className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                              dangerouslySetInnerHTML={{
                                __html: hit.highlight?.description?.[0] || hit.source.description,
                              }}
                            />
                          )}
                          {hit.source.category && (
                            <Badge variant="outline" className="mt-1.5 text-[10px]">
                              {hit.source.category}
                            </Badge>
                          )}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </>
              )}

              {!query && !error && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground space-y-3">
                  <p className="font-medium text-foreground/70">Elasticsearch-Powered Search</p>
                  <p className="text-xs">
                    Query your Elasticsearch indices in real time — scans, findings, and audit logs are all indexed and searchable.
                  </p>
                  <div className="text-xs space-y-1.5 text-left max-w-[320px] mx-auto">
                    <p className="text-muted-foreground/80 font-medium mb-1">Example queries:</p>
                    <p><span className="font-mono text-primary/80 bg-primary/5 px-1 rounded">"CVE-2024-1234"</span> — look up a specific CVE by ID</p>
                    <p><span className="font-mono text-primary/80 bg-primary/5 px-1 rounded">XSS</span> — find cross-site scripting findings</p>
                    <p><span className="font-mono text-primary/80 bg-primary/5 px-1 rounded">sql injection</span> — search for SQLi vulnerabilities</p>
                    <p><span className="font-mono text-primary/80 bg-primary/5 px-1 rounded">wordpress</span> — find CMS-related exposures</p>
                    <p><span className="font-mono text-primary/80 bg-primary/5 px-1 rounded">open ports</span> — surface port / service findings</p>
                    <p><span className="font-mono text-primary/80 bg-primary/5 px-1 rounded">example.com</span> — filter by target domain</p>
                  </div>
                </div>
              )}
            </div>

            {/* Aggregation summary */}
            {aggregations?.severity_counts && results.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-secondary/20 flex items-center gap-2 flex-wrap">
                {aggregations.severity_counts.buckets?.map((b: any) => (
                  <button
                    key={b.key}
                    onClick={() => handleFilterChange("severity", severityFilter === b.key ? "all" : b.key)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                      severityFilter === b.key
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {b.key}: {b.doc_count}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
