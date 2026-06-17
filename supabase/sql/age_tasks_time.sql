-- Horário opcional das tarefas pessoais (Meu Dia / Minhas Tarefas).
-- Formato usado pelo app: 'HH:MM' (texto). Usado para ordenar o dia e calcular atraso.
-- O app tolera a ausência desta coluna (escrita resiliente); rode isto para persistir.
ALTER TABLE age_tasks
ADD COLUMN IF NOT EXISTS task_time text;
