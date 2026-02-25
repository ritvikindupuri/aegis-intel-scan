import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch all enabled schedules that are due
    const now = new Date().toISOString();
    const { data: dueSchedules, error } = await supabase
      .from('scan_schedules')
      .select('*')
      .eq('enabled', true)
      .lte('next_run_at', now);

    if (error) throw error;

    if (!dueSchedules || dueSchedules.length === 0) {
      return new Response(JSON.stringify({ message: 'No schedules due', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${dueSchedules.length} due schedules`);

    const results: Array<{ scheduleId: string; domain: string; scanId?: string; error?: string }> = [];

    for (const schedule of dueSchedules) {
      try {
        // Invoke firecrawl-scan for this domain
        const scanResp = await fetch(`${supabaseUrl}/functions/v1/firecrawl-scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ domain: schedule.domain }),
        });

        const scanResult = await scanResp.json();
        const scanId = scanResult.scanId;

        // Calculate next run time
        const nextRun = calculateNextRun(schedule.frequency);

        // Update schedule
        await supabase.from('scan_schedules').update({
          last_scan_id: scanId || null,
          last_run_at: now,
          next_run_at: nextRun.toISOString(),
          updated_at: now,
        }).eq('id', schedule.id);

        results.push({ scheduleId: schedule.id, domain: schedule.domain, scanId });
        console.log(`Scheduled scan completed for ${schedule.domain}: scanId=${scanId}`);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        results.push({ scheduleId: schedule.id, domain: schedule.domain, error: errMsg });
        console.error(`Scheduled scan failed for ${schedule.domain}:`, e);

        // Still update next_run_at so we don't retry immediately
        const nextRun = calculateNextRun(schedule.frequency);
        await supabase.from('scan_schedules').update({
          last_run_at: now,
          next_run_at: nextRun.toISOString(),
          updated_at: now,
        }).eq('id', schedule.id);
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${results.length} scheduled scans`,
      processed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Scheduled scan runner error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}