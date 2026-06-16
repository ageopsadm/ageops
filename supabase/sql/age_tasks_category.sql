-- Categoria das tarefas pessoais (Meu Dia / Minhas Tarefas).
-- Valores usados pelo app: 'pessoal' | 'empresa' | 'cliente' | 'financeiro' | 'estudo'.
-- O app já tolera a ausência desta coluna (escrita resiliente), mas rode isto para persistir.
ALTER TABLE age_tasks
ADD COLUMN IF NOT EXISTS category text DEFAULT 'pessoal';
