-- Opcional: coluna dedicada ao cargo no convite (além de job_title já usado pelo app).
ALTER TABLE age_invites
ADD COLUMN IF NOT EXISTS cargo text;
