// AGE SOCIALS — Algoritmo de matching
// Recebe respostas do form → devolve resultado completo.

window.calculateMatch = function(answers) {
  const roles = window.AGE_ROLES;
  const scores = {};

  // Inicializa scores
  roles.forEach(r => scores[r.id] = 0);

  // 1) Áreas de interesse marcadas — peso ALTO (35 pts cada)
  (answers.interests || []).forEach(id => {
    if (scores[id] !== undefined) scores[id] += 35;
  });

  // 2) Ferramentas — cruza com tools de cada função (5 pts por match)
  const tools = (answers.tools || []).map(t => t.toLowerCase());
  roles.forEach(r => {
    r.tools.forEach(t => {
      if (tools.some(userTool => t.toLowerCase().includes(userTool) || userTool.includes(t.toLowerCase()))) {
        scores[r.id] += 5;
      }
    });
  });

  // 3) Texto livre — busca por keywords em campos abertos
  const freeText = [
    answers.proudProject || '',
    answers.mistake || '',
    answers.culture || '',
    answers.experience || ''
  ].join(' ').toLowerCase();

  roles.forEach(r => {
    r.keywords.forEach(kw => {
      const regex = new RegExp('\\b' + kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      const matches = freeText.match(regex);
      if (matches) scores[r.id] += matches.length * 2;
    });
  });

  // 4) Estilo de trabalho — calcula distância euclidiana ao perfil da função
  //    Quanto menor a distância, mais pontos.
  const userStyle = answers.style || {};
  roles.forEach(r => {
    let dist = 0;
    let count = 0;
    Object.keys(r.styleProfile).forEach(key => {
      const userVal = userStyle[key] !== undefined ? userStyle[key] : 50;
      const roleVal = r.styleProfile[key];
      dist += Math.pow(userVal - roleVal, 2);
      count++;
    });
    dist = Math.sqrt(dist / count); // 0 (perfeito) até ~100
    // converte em pontos: 0 dist = +25 pts, 100 dist = 0 pts
    scores[r.id] += Math.max(0, 25 - dist * 0.25);
  });

  // 5) Rotina ideal — roles associadas ganham +8
  const routine = window.ROUTINE_OPTIONS.find(o => o.id === answers.routine);
  if (routine) {
    routine.roles.forEach(rid => { if (scores[rid] !== undefined) scores[rid] += 8; });
  }

  // 6) Entrega em que rende melhor — +10 nas roles associadas
  const delivery = window.DELIVERY_OPTIONS.find(o => o.id === answers.delivery);
  if (delivery) {
    delivery.roles.forEach(rid => { if (scores[rid] !== undefined) scores[rid] += 10; });
  }

  // Ordena
  const ranked = roles
    .map(r => ({ role: r, score: scores[r.id] }))
    .sort((a, b) => b.score - a.score);

  // Normaliza top score para % (max teórico ~130)
  const maxTheoretical = 130;
  const top = ranked[0];
  const topMatchPct = Math.min(99, Math.round((top.score / maxTheoretical) * 100));

  const top3 = ranked.slice(0, 3).map(item => ({
    role: item.role,
    match: Math.min(99, Math.round((item.score / maxTheoretical) * 100))
  }));

  // === SCORES ===

  // Score técnico:
  // - Ferramentas quantidade (até 30 pts)
  // - Anos de experiência (até 30 pts)
  // - Portfólio presente (20 pts)
  // - LinkedIn presente (10 pts)
  // - Score bruto da função top já indica fit técnico (até 10 pts extra)
  const years = parseFloat(answers.experienceYears) || 0;
  let technical = 0;
  technical += Math.min(30, (answers.tools?.length || 0) * 3);
  technical += Math.min(30, years * 5);
  technical += (answers.portfolio && answers.portfolio.trim().length > 5) ? 20 : 0;
  technical += (answers.linkedin && answers.linkedin.trim().length > 5) ? 10 : 0;
  technical += Math.min(10, top.score / 15);
  technical = Math.round(Math.min(100, technical));

  // Score cultural: procura por palavras-chave em cultura, erro, projeto orgulho
  const cultureText = [
    answers.culture || '',
    answers.mistake || '',
    answers.proudProject || ''
  ].join(' ').toLowerCase();

  const CULTURE_KEYWORDS = {
    positive: [
      'aprend', 'errei', 'erro', 'time', 'juntos', 'colabor', 'ouvir', 'escut',
      'humild', 'referência', 'estud', 'evolu', 'process', 'feedback', 'dono',
      'iniciativa', 'responsáv', 'entreg', 'compromiss', 'craft', 'detalhe',
      'client', 'pessoa', 'gente', 'crescer', 'cresci', 'ajud', 'apoi',
      'curios', 'ideia', 'test', 'tentei', 'melhor', 'improvi', 'adapt'
    ]
  };

  let cultural = 40; // base
  CULTURE_KEYWORDS.positive.forEach(kw => {
    if (cultureText.includes(kw)) cultural += 3;
  });
  // Bônus por tamanho de texto (esforço na resposta)
  const totalLen = cultureText.length;
  if (totalLen > 300) cultural += 15;
  else if (totalLen > 150) cultural += 8;
  else if (totalLen > 50) cultural += 3;

  // Penalidade se todos os textos estão vazios ou muito curtos
  if (totalLen < 30) cultural = Math.max(20, cultural - 20);

  cultural = Math.round(Math.min(100, cultural));

  // Score geral: média ponderada (fit + cultural + técnico)
  const fitScore = Math.round((top.score / maxTheoretical) * 100);
  const overall = Math.round(fitScore * 0.4 + cultural * 0.3 + technical * 0.3);

  // === SENIORIDADE ===
  let seniority;
  if (years < 1) {
    seniority = 'Promissor em desenvolvimento';
  } else if (years < 3) {
    seniority = technical >= 70 ? 'Pleno' : 'Júnior';
  } else if (years < 6) {
    seniority = technical >= 75 ? 'Sênior' : 'Pleno';
  } else {
    seniority = 'Sênior';
  }

  // Mensagem personalizada
  const messages = {
    'Promissor em desenvolvimento': 'Energia e vontade são matéria-prima. A gente cuida do resto.',
    'Júnior': 'Base sólida e caminho pela frente. Lugar certo pra crescer rápido.',
    'Pleno': 'Autonomia sem perder o time. Você entra pra entregar de verdade.',
    'Sênior': 'Repertório, direção e voz. Você chega pra puxar a régua.'
  };

  return {
    topRole: top.role,
    topMatch: topMatchPct,
    top3,
    scores: {
      overall: Math.min(99, overall),
      cultural: Math.min(99, cultural),
      technical: Math.min(99, technical)
    },
    seniority,
    message: messages[seniority],
    fitScore
  };
};
