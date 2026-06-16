/**
 * Cria planos na API clássica Pagar.me (/1/plans) — preços beta usuário desenvolvedor.
 * Uso: PAGARME_API_KEY='sk_…' node createPlans.js
 *
 * Copie cada ID impresso para age-ops-v4.html → PAGARME_PLANS (mesma chave: solo_mensal, …).
 * Nunca commite chaves; use apenas variável de ambiente ou .env local (gitignored).
 *
 * Nota: contas Pagar.me API V5 (sk_/pk_) podem não funcionar em /1/plans — se falhar,
 * crie os planos manualmente no dashboard com estes valores e cole só os IDs no HTML.
 */
'use strict';

const API_KEY = String(process.env.PAGARME_API_KEY || '').trim();

if (!API_KEY) {
  console.error('Erro: defina PAGARME_API_KEY com a chave secreta (sk_… ou ak_live_…).');
  console.error("Exemplo: PAGARME_API_KEY='sk_…' node createPlans.js");
  process.exit(1);
}

if (API_KEY.startsWith('pk_')) {
  console.error('Erro: pk_ é chave pública. Use a sk_… da tabela "Chaves da API" no dashboard.');
  process.exit(1);
}

/** Preços beta (centavos). Trial no plano: 23 dias após cartão (7 dias sem cartão ficam no app). */
const planos = [
  { key: 'solo_mensal',      name: 'Age Ops Freelancer Beta Mensal',  amount: 4990,  days: 30,  trial_days: 23 },
  { key: 'solo_anual',       name: 'Age Ops Freelancer Beta Anual',   amount: 49900, days: 365, trial_days: 23 },
  { key: 'produtora_mensal', name: 'Age Ops Produtora Beta Mensal',   amount: 9990,  days: 30,  trial_days: 23 },
  { key: 'produtora_anual',  name: 'Age Ops Produtora Beta Anual',    amount: 99900, days: 365, trial_days: 23 },
  { key: 'agencia_mensal',   name: 'Age Ops Agência Beta Mensal',     amount: 19990, days: 30,  trial_days: 23 },
  { key: 'agencia_anual',    name: 'Age Ops Agência Beta Anual',      amount: 199900, days: 365, trial_days: 23 },
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

  console.log(`${plano.key}: ${plano.name} → ID: ${data.id} (R$${(plano.amount / 100).toFixed(2).replace('.', ',')})`);
  return { ok: true, data };
}

(async () => {
  console.log('\n--- Planos beta Age Ops (API /1/plans) ---\n');
  const ids = {};
  let failed = 0;
  for (const p of planos) {
    const r = await criarPlano(p);
    if (!r.ok) failed++;
    else if (r.data?.id) ids[p.key] = String(r.data.id);
    await new Promise((r2) => setTimeout(r2, 500));
  }
  if (Object.keys(ids).length) {
    console.log('\n--- Cole em age-ops-v4.html → PAGARME_PLANS ---\n');
    console.log('const PAGARME_PLANS = {');
    for (const p of planos) {
      const id = ids[p.key] || 'SUBSTITUA_PELO_ID';
      console.log(`  ${p.key}: '${id}',`);
    }
    console.log('};\n');
  }
  if (failed) {
    console.error(`\nConcluído com ${failed} erro(s). Se sk_ da API V5 falhar, crie planos no dashboard V5 e cole só os IDs.`);
    process.exit(1);
  }
})();
