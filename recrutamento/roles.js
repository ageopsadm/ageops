// AGE SOCIALS — Funções e perfis para matching
// Cada função tem: keywords (texto livre), tools (ferramentas afins),
// styleProfile (perfil ideal em sliders 0-100), description curta.

window.AGE_ROLES = [
  {
    id: 'social_media',
    number: '01',
    name: 'Social Media',
    tagline: 'Vive o feed. Traduz marca em post.',
    description: 'Planeja calendário editorial, publica, monitora métricas e transforma insights em conteúdo.',
    keywords: ['conteúdo', 'feed', 'post', 'engajamento', 'calendário', 'legenda', 'trend', 'reels', 'instagram', 'tiktok', 'linkedin', 'audiência', 'métrica', 'copy', 'briefing'],
    tools: ['Instagram', 'TikTok', 'LinkedIn', 'Meta Business', 'Later', 'Notion', 'Canva', 'CapCut', 'Figma', 'Trello'],
    styleProfile: { pace: 80, autonomy: 60, structure: 70, creative: 75, social: 85, detail: 65 },
    keywordCulture: ['pessoas', 'comunidade', 'trend', 'observador']
  },
  {
    id: 'designer',
    number: '02',
    name: 'Designer',
    tagline: 'Estética é argumento.',
    description: 'Desenha identidade visual, peças, sistemas gráficos e sustenta o padrão estético da marca.',
    keywords: ['design', 'identidade', 'tipografia', 'grid', 'cor', 'layout', 'branding', 'visual', 'estética', 'ilustração', 'sistema', 'peça', 'arte'],
    tools: ['Figma', 'Adobe Illustrator', 'Photoshop', 'InDesign', 'After Effects', 'Blender'],
    styleProfile: { pace: 55, autonomy: 75, structure: 80, creative: 95, social: 40, detail: 90 },
    keywordCulture: ['detalhe', 'referência', 'estética', 'craft']
  },
  {
    id: 'editor_video',
    number: '03',
    name: 'Editor de Vídeo',
    tagline: 'Ritmo é linguagem.',
    description: 'Monta, corta, colore. Transforma bruto em narrativa que segura o dedo no scroll.',
    keywords: ['edição', 'corte', 'ritmo', 'transição', 'color', 'sound', 'narrativa', 'reels', 'timeline', 'raw', 'bruto'],
    tools: ['Premiere', 'DaVinci Resolve', 'CapCut', 'Final Cut', 'After Effects', 'Audition'],
    styleProfile: { pace: 70, autonomy: 70, structure: 75, creative: 85, social: 35, detail: 85 },
    keywordCulture: ['ritmo', 'música', 'narrativa', 'foco']
  },
  {
    id: 'filmmaker',
    number: '04',
    name: 'Filmmaker',
    tagline: 'Captura o momento antes de virar história.',
    description: 'Direção, câmera, luz e som em set. Traduz conceito em imagem em movimento.',
    keywords: ['câmera', 'direção', 'set', 'luz', 'lente', 'áudio', 'gravação', 'diária', 'filmagem', 'roteiro', 'cinematografia'],
    tools: ['Sony', 'Canon', 'BlackMagic', 'DJI', 'Rode', 'Premiere', 'DaVinci Resolve', 'Iluminação'],
    styleProfile: { pace: 65, autonomy: 80, structure: 65, creative: 90, social: 70, detail: 85 },
    keywordCulture: ['set', 'campo', 'improviso', 'presença']
  },
  {
    id: 'copywriter',
    number: '05',
    name: 'Copywriter',
    tagline: 'Cada palavra pesa. Ou não deveria estar ali.',
    description: 'Escreve manifesto, headline, roteiro, copy de tráfego. Encontra o ângulo antes do texto.',
    keywords: ['copy', 'texto', 'headline', 'roteiro', 'palavra', 'escrita', 'narrativa', 'briefing', 'ângulo', 'insight', 'manifesto', 'slogan', 'ideia'],
    tools: ['Notion', 'Google Docs', 'ChatGPT', 'Claude', 'Grammarly'],
    styleProfile: { pace: 60, autonomy: 75, structure: 70, creative: 90, social: 55, detail: 80 },
    keywordCulture: ['leitura', 'observação', 'ideia', 'palavra']
  },
  {
    id: 'trafego',
    number: '06',
    name: 'Gestor de Tráfego',
    tagline: 'CAC, CTR, ROAS. E dorme bem.',
    description: 'Estrutura, otimiza e escala campanhas pagas em Meta, Google, TikTok. Vive de teste e dado.',
    keywords: ['tráfego', 'ads', 'campanha', 'ctr', 'cpc', 'cpa', 'roas', 'conversão', 'pixel', 'público', 'lookalike', 'teste', 'métrica', 'funil'],
    tools: ['Meta Ads', 'Google Ads', 'TikTok Ads', 'GA4', 'Google Tag Manager', 'Hotjar', 'Looker'],
    styleProfile: { pace: 75, autonomy: 80, structure: 90, creative: 45, social: 40, detail: 95 },
    keywordCulture: ['número', 'dado', 'teste', 'hipótese']
  },
  {
    id: 'atendimento',
    number: '07',
    name: 'Atendimento / CS',
    tagline: 'Ponte entre cliente e agência. Diplomacia é técnica.',
    description: 'Cuida da relação com o cliente, briefa, alinha expectativa, protege o time e entrega no prazo.',
    keywords: ['cliente', 'reunião', 'briefing', 'alinhamento', 'expectativa', 'relacionamento', 'prazo', 'apresentação', 'call', 'follow', 'ponte'],
    tools: ['Notion', 'Slack', 'Google Meet', 'Loom', 'Trello', 'Asana', 'Pipefy'],
    styleProfile: { pace: 80, autonomy: 70, structure: 85, creative: 50, social: 95, detail: 80 },
    keywordCulture: ['pessoas', 'empatia', 'escuta', 'clareza']
  },
  {
    id: 'estrategia',
    number: '08',
    name: 'Estratégia / Planejamento',
    tagline: 'Antes da execução, o porquê.',
    description: 'Lê mercado, marca, dado e cultura. Define território, tom e caminho antes do time criativo executar.',
    keywords: ['estratégia', 'planejamento', 'insight', 'marca', 'território', 'pesquisa', 'benchmark', 'posicionamento', 'brief', 'plano', 'tese', 'cultura'],
    tools: ['Notion', 'Miro', 'Google Trends', 'Semrush', 'Meltwater', 'Figma', 'Keynote'],
    styleProfile: { pace: 55, autonomy: 85, structure: 90, creative: 80, social: 70, detail: 85 },
    keywordCulture: ['leitura', 'contexto', 'pensamento', 'tese']
  },
  {
    id: 'motion',
    number: '09',
    name: 'Motion Designer',
    tagline: 'O frame que segura o polegar.',
    description: 'Anima, dá vida a peças estáticas, cria openers, lower thirds, transições e sistemas em movimento.',
    keywords: ['motion', 'animação', 'keyframe', 'after effects', 'ease', 'timing', 'transição', 'loop', 'render', '3d', 'rig'],
    tools: ['After Effects', 'Cinema 4D', 'Blender', 'Figma', 'Illustrator', 'Photoshop', 'DaVinci'],
    styleProfile: { pace: 60, autonomy: 75, structure: 80, creative: 95, social: 40, detail: 95 },
    keywordCulture: ['detalhe', 'timing', 'referência', 'craft']
  },
  {
    id: 'community',
    number: '10',
    name: 'Community Manager',
    tagline: 'Vive nos comentários. Constrói vínculo.',
    description: 'Responde, conversa, monitora sentimento, ativa comunidade e transforma seguidor em fã.',
    keywords: ['comunidade', 'comentário', 'dm', 'conversa', 'sentimento', 'engajamento', 'resposta', 'fã', 'seguidor', 'monitorar', 'crise', 'moderação'],
    tools: ['Instagram', 'TikTok', 'X', 'Discord', 'Reddit', 'Meltwater', 'Notion', 'Slack'],
    styleProfile: { pace: 85, autonomy: 65, structure: 60, creative: 65, social: 95, detail: 70 },
    keywordCulture: ['pessoas', 'conversa', 'escuta', 'empatia']
  },
  {
    id: 'projetos',
    number: '11',
    name: 'Projetos / Operação',
    tagline: 'Sem processo, ninguém entrega.',
    description: 'Estrutura workflows, prazos, entregas e mantém o caos organizado. É o esqueleto da agência.',
    keywords: ['projeto', 'operação', 'processo', 'workflow', 'prazo', 'entrega', 'checklist', 'gestão', 'time', 'organização', 'kanban', 'ritual'],
    tools: ['Notion', 'Asana', 'Trello', 'ClickUp', 'Monday', 'Slack', 'Pipefy'],
    styleProfile: { pace: 75, autonomy: 80, structure: 95, creative: 40, social: 75, detail: 95 },
    keywordCulture: ['organização', 'clareza', 'processo', 'ritual']
  },
  {
    id: 'comercial',
    number: '12',
    name: 'Comercial',
    tagline: 'Traduz agência em proposta que fecha.',
    description: 'Prospecta, apresenta, negocia e assina. Vive da relação e da leitura do que o cliente precisa.',
    keywords: ['comercial', 'venda', 'proposta', 'prospect', 'negociação', 'fechar', 'pitch', 'reunião', 'contrato', 'lead', 'cliente', 'cold'],
    tools: ['HubSpot', 'Pipedrive', 'RD Station', 'LinkedIn Sales', 'Notion', 'Google Meet', 'Loom'],
    styleProfile: { pace: 85, autonomy: 85, structure: 75, creative: 55, social: 95, detail: 70 },
    keywordCulture: ['pessoas', 'meta', 'lead', 'pitch']
  }
];

// Estilo de trabalho — perguntas sliders 0-100
window.STYLE_QUESTIONS = [
  { key: 'pace', label: 'Prefiro trabalhar num ritmo...', low: 'Lento e reflexivo', high: 'Rápido e reativo' },
  { key: 'autonomy', label: 'Rendo mais quando...', low: 'Tenho direção clara', high: 'Tenho autonomia total' },
  { key: 'structure', label: 'Meu ambiente ideal é...', low: 'Fluido e improvisado', high: 'Estruturado e planejado' },
  { key: 'creative', label: 'Meu trabalho é mais...', low: 'Analítico e técnico', high: 'Criativo e conceitual' },
  { key: 'social', label: 'Prefiro passar o dia...', low: 'No foco individual', high: 'Em contato com pessoas' },
  { key: 'detail', label: 'Sou mais...', low: 'Big picture', high: 'Obcecado por detalhe' }
];

// Rotina ideal — múltipla escolha
window.ROUTINE_OPTIONS = [
  { id: 'creative_morning', label: 'Manhã criativa, tarde de execução', roles: ['designer', 'copywriter', 'motion', 'editor_video', 'estrategia'] },
  { id: 'reactive', label: 'Reagir ao que aparece no dia — dinâmico', roles: ['social_media', 'community', 'atendimento', 'comercial'] },
  { id: 'deep_focus', label: 'Blocos longos de foco profundo', roles: ['designer', 'editor_video', 'motion', 'copywriter', 'trafego', 'estrategia'] },
  { id: 'meetings', label: 'Reuniões, calls, alinhamentos o dia todo', roles: ['atendimento', 'comercial', 'projetos', 'estrategia'] },
  { id: 'field', label: 'No campo, gravando, fora do escritório', roles: ['filmmaker', 'social_media'] },
  { id: 'dashboard', label: 'Olhando painéis, ajustando, otimizando', roles: ['trafego', 'projetos'] }
];

// Entrega em que rende melhor
window.DELIVERY_OPTIONS = [
  { id: 'campaign', label: 'Campanha inteira, do brief à entrega', roles: ['estrategia', 'copywriter', 'atendimento', 'projetos'] },
  { id: 'piece', label: 'Peça pontual, focada, com craft', roles: ['designer', 'motion', 'editor_video', 'copywriter'] },
  { id: 'volume', label: 'Volume alto de conteúdo diário', roles: ['social_media', 'community', 'editor_video'] },
  { id: 'performance', label: 'Otimização contínua com dado', roles: ['trafego', 'projetos'] },
  { id: 'people', label: 'Cuidando de gente — cliente ou time', roles: ['atendimento', 'projetos', 'comercial', 'community'] },
  { id: 'production', label: 'Produção em set, câmera, luz', roles: ['filmmaker'] },
  { id: 'newbiz', label: 'Prospecção, pitch, novos negócios', roles: ['comercial'] }
];
