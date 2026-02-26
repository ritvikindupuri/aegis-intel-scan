
-- Allow users to delete their own scans
CREATE POLICY "Users can delete their own scans"
  ON public.scans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow users to delete findings for their own scans
CREATE POLICY "Users can delete their own findings"
  ON public.findings
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM scans WHERE scans.id = findings.scan_id AND scans.user_id = auth.uid()
  ));
