import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const esUrl = Deno.env.get('ELASTICSEARCH_URL');
  const esUser = Deno.env.get('ELASTICSEARCH_USERNAME');
  const esPass = Deno.env.get('ELASTICSEARCH_PASSWORD');

  if (!esUrl || !esUser || !esPass) {
    return new Response(JSON.stringify({ error: 'Elasticsearch not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const esAuth = btoa(`${esUser}:${esPass}`);

  try {
    const { query, index, filters, size = 20, from = 0, aggs } = await req.json();

    // Build search body
    const searchBody: any = { size, from };

    if (query) {
      searchBody.query = {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['title^3', 'description^2', 'domain^2', 'category', 'ai_report', 'technologies'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              }
            }
          ],
          filter: [],
        }
      };

      // Apply filters
      if (filters?.severity) {
        searchBody.query.bool.filter.push({ term: { severity: filters.severity } });
      }
      if (filters?.category) {
        searchBody.query.bool.filter.push({ term: { category: filters.category } });
      }
      if (filters?.domain) {
        searchBody.query.bool.filter.push({ term: { domain: filters.domain } });
      }
      if (filters?.dateFrom || filters?.dateTo) {
        const range: any = { created_at: {} };
        if (filters.dateFrom) range.created_at.gte = filters.dateFrom;
        if (filters.dateTo) range.created_at.lte = filters.dateTo;
        searchBody.query.bool.filter.push({ range });
      }
    } else {
      searchBody.query = { match_all: {} };
    }

    // Add sorting
    searchBody.sort = [{ _score: 'desc' }, { created_at: 'desc' }];

    // Add highlight
    searchBody.highlight = {
      fields: {
        title: { number_of_fragments: 1 },
        description: { number_of_fragments: 2, fragment_size: 150 },
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
    };

    // Add aggregations if requested
    if (aggs) {
      searchBody.aggs = {};
      if (aggs.includes('severity')) {
        searchBody.aggs.severity_counts = { terms: { field: 'severity' } };
      }
      if (aggs.includes('category')) {
        searchBody.aggs.category_counts = { terms: { field: 'category', size: 20 } };
      }
      if (aggs.includes('domain')) {
        searchBody.aggs.domain_counts = { terms: { field: 'domain', size: 20 } };
      }
      if (aggs.includes('timeline')) {
        searchBody.aggs.timeline = {
          date_histogram: { field: 'created_at', calendar_interval: 'day' }
        };
      }
    }

    const targetIndex = index || 'threatlens-findings';

    const resp = await fetch(`${esUrl}/${targetIndex}/_search`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${esAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('ES search error:', data);
      throw new Error(`Search failed: ${resp.status}`);
    }

    const results = {
      total: data.hits?.total?.value || 0,
      hits: (data.hits?.hits || []).map((hit: any) => ({
        id: hit._id,
        index: hit._index,
        score: hit._score,
        source: hit._source,
        highlight: hit.highlight,
      })),
      aggregations: data.aggregations || null,
    };

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Search failed'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
