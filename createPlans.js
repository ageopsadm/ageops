/**
 * Cria planos na API clássica Pagar.me (/1/plans).
 * Uso: PAGARME_API_KEY='ak_live_…' node createPlans.js
 * Ou: copie .env.example para .env e rode com variável exportada pelo seu shell.
 *
 * Nunca commite chaves; use apenas variável de ambiente ou .env local (gitignored).
 */
'use strict';

const API_KEY = String(process.env.PAGARME_API_KEY || '').trim();

if (!API_KEY) {
  console.error(
    'Erro: defina PAGARME_API_KEY com a chave secreta (ak_live_…) do dashboard Pagar.me.',
  );
  console.error('Exemplo: PAGARME_API_KEY=\'ak_live_…\' node createPlans.js');
  process.exit(1);
}

if (API_KEY.startsWith('pk_')) {
  console.error(
    'Erro: pk_ é chave pública; este script precisa da chave secreta ak_live_…',
  );
  process.exit(1);
}

const planos = [
  { name: 'Solo Mensal', amount: 14700, days: 30, trial_days: 7 },
  { name: 'Solo Anual', amount: 116400, days: 365, trial_days: 7 },
  { name: 'Produtora Mensal', amount: 29700, days: 30, trial_days: 7 },
  { name: 'Produtora Anual', amount: 236400, days: 365, trial_days: 7 },
  { name: 'Agência Mensal', amount: 59700, days: 30, trial_days: 7 },
  { name: 'Agência Anual', amount: 476400, days: 365, trial_days: 7 },
];

function safeApiMessage(data) {
  if (!data || typeof data !== 'object') return String(data);
  const msg = data.message || data.error || data.errors;
  if (typeof msg === 'string') return msg;
  if (msg != null) return JSON.stringify(msg);
  return JSON.stringify(data);
}

async function criarPlano(plano) {
  const resp = await fetch('https://api.pagar.me/1/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: API_KEY,
      name: plano.name,
      amount: plano.amount,
      days: plano.days,
      trial_days: plano.trial_days,
      payment_methods: ['credit_card'],
    }),
  });
  let data;
  try {
    data = await resp.json();
  } catch {
    data = {};
  }

  if (!resp.ok || !data.id) {
    const hint = !resp.ok ? `HTTP ${resp.status}` : 'sem id';
    console.error(
      `${plano.name} → falha (${hint}):`,
      safeApiMessage(data),
    );
    return { ok: false, data };
  }

  console.log(plano.name, '→ ID:', data.id);
  return { ok: true, data };
}

(async () => {
  let failed = 0;
  for (const p of planos) {
    const r = await criarPlano(p);
    if (!r.ok) failed++;
    await new Promise((r2) => setTimeout(r2, 500));
  }
  if (failed) {
    console.error(`\nConcluído com ${failed} erro(s). Revise a chave (deve ser ak_live_… para API /1/).`);
    process.exit(1);
  }
})();
