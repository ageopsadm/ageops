-- AGE SOCIALS · Recrutamento — DELETE de candidaturas e links
-- Rode no SQL Editor se a aba Recrutamento recusar exclusão (RLS sem política DELETE).
-- Isolamento real por empresa continua em rls_multitenant.sql.

GRANT DELETE ON TABLE public.age_candidates TO anon, authenticated;
GRANT DELETE ON TABLE public.age_match_results TO anon, authenticated;
GRANT DELETE ON TABLE public.age_ai_analysis TO anon, authenticated;
GRANT DELETE ON TABLE public.age_recruit_links TO anon, authenticated;

DROP POLICY IF EXISTS age_candidates_delete ON public.age_candidates;
CREATE POLICY age_candidates_delete ON public.age_candidates
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_match_results_delete ON public.age_match_results;
CREATE POLICY age_match_results_delete ON public.age_match_results
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_ai_analysis_delete ON public.age_ai_analysis;
CREATE POLICY age_ai_analysis_delete ON public.age_ai_analysis
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS age_recruit_links_delete ON public.age_recruit_links;
CREATE POLICY age_recruit_links_delete ON public.age_recruit_links
  FOR DELETE TO anon, authenticated USING (true);
