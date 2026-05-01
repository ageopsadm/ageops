// ============================================
//   AGE OPS — MISSION DATA
// ============================================

const MISSION_DATA = {
    days: {
        sexta: {
            id: 'sexta',
            label: 'SEXTA-FEIRA',
            shortLabel: 'SEXTA',
            dayNum: 1,
            focus: 'Contratos, fechamentos, financeiro e pendências comerciais',
            tasks: [
                { id: 'sf01', area: 'CONTRATOS', label: 'Enviar contrato do Lucas (Cobertec)', priority: 'high' },
                { id: 'sf02', area: 'CONTRATOS', label: 'Enviar contrato do Yuri', priority: 'high' },
                { id: 'sf03', area: 'CONTRATOS', label: 'Enviar contrato do Thadeu (Content Day)', priority: 'high' },
                { id: 'sf04', area: 'RECEBIMENTOS', label: 'Receber retorno/documento do Thadeu', priority: 'high' },
                { id: 'sf05', area: 'EQUIPE', label: 'Fechar fotógrafo para o evento de 4 dias', priority: 'high' },
                { id: 'sf06', area: 'EQUIPE', label: 'Decidir com Paulin: evento Thadeu com Ken ou nova pessoa', priority: 'high' },
                { id: 'sf07', area: 'COMERCIAL', label: 'Fechar contrato com Lucas da Cobertec (assinatura)', priority: 'high' },
                { id: 'sf08', area: 'EQUIPE FIXA', label: 'Contratar designer para Age Socials', priority: 'high' },
                { id: 'sf09', area: 'ENTREGAS', label: 'Entregar 4 conteúdos da Talita', priority: 'high' },
                { id: 'sf10', area: 'COBRANÇA', label: 'Cobrar Talita', priority: 'high' },
                { id: 'sf11', area: 'COMERCIAL', label: 'Fechar extensão com Irmãs Lira — R$ 750', priority: 'high' },
                { id: 'sf12', area: 'PRODUÇÃO', label: 'Fechar estúdio para Content Day dia 04', priority: 'high' },
                { id: 'sf13', area: 'VENDAS', label: 'Fechar pelo menos +1 cliente para o Content Day', priority: 'high' },
            ],
            schedule: [
                { time: '09:00 - 10:00', block: 'CONTRATOS', tasks: 'Finalizar e enviar contratos: Lucas, Yuri e Thadeu' },
                { time: '10:00 - 11:00', block: 'COBRANÇAS', tasks: 'Cobrar Thadeu, Talita, Irmãs Lira, Thiago Sub, Cobertec' },
                { time: '11:00 - 12:00', block: 'FECHAMENTOS', tasks: 'Fechar contrato Lucas Cobertec + extensão Irmãs Lira' },
                { time: '14:00 - 15:00', block: 'EQUIPE', tasks: 'Resolver fotógrafo 4 dias + decidir com Paulin sobre evento Thadeu/Ken' },
                { time: '15:00 - 16:00', block: 'FORNECEDORES', tasks: 'Buscar designer e tentar fechar' },
                { time: '16:00 - 17:00', block: 'ENTREGAS', tasks: 'Finalizar e entregar 4 conteúdos da Talita' },
                { time: '17:00 - 18:00', block: 'PRODUÇÃO', tasks: 'Fechar estúdio do Content Day dia 04' },
                { time: '18:00 - 20:00', block: 'COMERCIAL', tasks: 'Prospectar e tentar fechar +1 cliente para o Content Day' },
            ]
        },
        sabado: {
            id: 'sabado',
            label: 'SÁBADO',
            shortLabel: 'SÁBADO',
            dayNum: 2,
            focus: 'Operação Holambra + logística + entrega realtime',
            tasks: [
                { id: 'sa01', area: 'OPERAÇÃO', label: 'Acordar 06:00 e buscar o carro 06:30', priority: 'high' },
                { id: 'sa02', area: 'LOGÍSTICA', label: 'Buscar equipe (Vic, Amarante, Gustavo)', priority: 'high' },
                { id: 'sa03', area: 'OPERAÇÃO', label: 'Deslocamento e organização para Holambra', priority: 'high' },
                { id: 'sa04', area: 'CAPTAÇÃO', label: 'Gravação em Holambra (20:00 - 21:00)', priority: 'high' },
                { id: 'sa05', area: 'PARALELO', label: 'Show do Thadeu com Paulin e Ken', priority: 'high' },
                { id: 'sa06', area: 'ENTREGA', label: 'Organizar material para entrega realtime', priority: 'high' },
                { id: 'sa07', area: 'LOGÍSTICA', label: 'Retorno para São Paulo (noite)', priority: 'high' },
            ],
            schedule: [
                { time: '06:00', block: 'DESPERTAR', tasks: 'Acordar e preparação' },
                { time: '06:30', block: 'LOGÍSTICA', tasks: 'Pegar o carro' },
                { time: '07:00', block: 'EQUIPE', tasks: 'Buscar equipe (Vic, Amarante, Gustavo)' },
                { time: 'MANHÃ/TARDE', block: 'DESLOCAMENTO', tasks: 'Viagem e organização operacional' },
                { time: '20:00 - 21:00', block: '🎬 GRAVAÇÃO', tasks: 'Captação em Holambra' },
                { time: 'APÓS GRAVAÇÃO', block: 'RETORNO', tasks: 'Volta para São Paulo' },
                { time: 'NOITE', block: 'DESCANSO', tasks: 'Dormir para retornar cedo no domingo' },
            ]
        },
        domingo: {
            id: 'domingo',
            label: 'DOMINGO',
            shortLabel: 'DOMINGO',
            dayNum: 3,
            focus: 'Gravação + entrega realtime + descanso',
            tasks: [
                { id: 'do01', area: 'CAPTAÇÃO', label: 'Gravação 06:00 - 12:00', priority: 'high' },
                { id: 'do02', area: 'ENTREGA', label: 'Entrega realtime (tarde)', priority: 'high' },
                { id: 'do03', area: 'DESCANSO', label: 'Descanso em casa (noite)', priority: 'med' },
            ],
            schedule: [
                { time: '06:00 - 12:00', block: '🎬 GRAVAÇÃO', tasks: 'Captação completa' },
                { time: 'TARDE', block: 'ENTREGA', tasks: 'Entrega realtime do material' },
                { time: 'NOITE', block: 'DESCANSO', tasks: 'Recuperação e descanso em casa' },
            ]
        },
        segunda: {
            id: 'segunda',
            label: 'SEGUNDA-FEIRA',
            shortLabel: 'SEGUNDA',
            dayNum: 4,
            focus: 'Evento Alphaville — Dia 1',
            tasks: [
                { id: 'se01', area: 'OPERAÇÃO', label: 'Início da operação Alphaville 07:00', priority: 'high' },
                { id: 'se02', area: 'COBERTURA', label: 'Cobertura completa do evento Alphaville', priority: 'high' },
                { id: 'se03', area: 'ENTREGA', label: 'Entregar 1 reel no dia', priority: 'high' },
            ],
            schedule: [
                { time: '07:00', block: '🚀 OPERAÇÃO', tasks: 'Início da cobertura Alphaville' },
                { time: 'DURANTE O DIA', block: 'COBERTURA', tasks: 'Evento Alphaville completo' },
                { time: 'FIM DO DIA', block: '📦 ENTREGA', tasks: '1 Reel entregue no dia' },
            ]
        },
        terca: {
            id: 'terca',
            label: 'TERÇA-FEIRA',
            shortLabel: 'TERÇA',
            dayNum: 5,
            focus: 'Evento Alphaville — Dia 2',
            tasks: [
                { id: 'te01', area: 'OPERAÇÃO', label: 'Início da operação Alphaville 07:00 (dia 2)', priority: 'high' },
                { id: 'te02', area: 'COBERTURA', label: 'Cobertura completa do evento Alphaville dia 2', priority: 'high' },
                { id: 'te03', area: 'ENTREGA', label: 'Entregar 1 reel no dia', priority: 'high' },
            ],
            schedule: [
                { time: '07:00', block: '🚀 OPERAÇÃO', tasks: 'Início da cobertura Alphaville — Dia 2' },
                { time: 'DURANTE O DIA', block: 'COBERTURA', tasks: 'Evento Alphaville — segundo dia' },
                { time: 'FIM DO DIA', block: '📦 ENTREGA', tasks: '1 Reel entregue no dia' },
            ]
        },
        quarta: {
            id: 'quarta',
            label: 'QUARTA-FEIRA',
            shortLabel: 'QUARTA',
            dayNum: 6,
            focus: 'Content Day — 100% foco em vendas',
            tasks: [
                { id: 'qu01', area: 'COMERCIAL', label: 'Foco total no Content Day — fechar 2 vagas finais', priority: 'high' },
                { id: 'qu02', area: 'PROSPECÇÃO', label: 'Prospectar terceiros fora da base atual', priority: 'high' },
                { id: 'qu03', area: 'FECHAMENTO', label: 'Converter interessados e bater meta final de vagas', priority: 'high' },
            ],
            schedule: [
                { time: 'DIA INTEIRO', block: '🎯 CONTENT DAY', tasks: 'Foco 100% em comercial' },
                { time: 'MANHÃ', block: 'PROSPECÇÃO', tasks: 'Abordar terceiros fora da base' },
                { time: 'TARDE/NOITE', block: 'FECHAMENTO', tasks: 'Converter interessados — bater meta das 2 vagas' },
            ]
        }
    },

    financial: [
        { id: 'f01', client: 'THADEU', value: 2500, obs: 'Receber hoje', priority: true },
        { id: 'f02', client: 'IRMÃS LIRA', value: 750, obs: 'Receber hoje', priority: true },
        { id: 'f03', client: 'THIAGO SUB', value: 1500, obs: 'Receber', priority: false },
        { id: 'f04', client: 'ALPHAVILLE', value: 4000, obs: 'Receber', priority: false },
        { id: 'f05', client: 'COBERTEC', value: 3000, obs: 'Receber', priority: false },
        { id: 'f06', client: 'THADEU', value: 2500, obs: '2ª Parcela', priority: false },
        { id: 'f07', client: 'TALITA', value: 5000, obs: 'Cobrar / receber', priority: true },
        { id: 'f08', client: 'THADEU', value: 1500, obs: 'Confirmar origem', priority: false },
        { id: 'f09', client: 'BILL', value: 1500, obs: 'Receber', priority: false },
        { id: 'f10', client: 'GUI', value: 1000, obs: 'Receber', priority: false },
    ],

    weekGoals: [
        { day: 'SEXTA', goal: 'Contratos, cobranças, equipe, estúdio e vendas', dayKey: 'sexta' },
        { day: 'SÁBADO', goal: 'Operação Holambra sem falhas + realtime', dayKey: 'sabado' },
        { day: 'DOMINGO', goal: 'Gravação + entrega realtime + descanso', dayKey: 'domingo' },
        { day: 'SEGUNDA', goal: 'Entregar reel do evento Alphaville', dayKey: 'segunda' },
        { day: 'TERÇA', goal: 'Entregar reel do 2º dia Alphaville', dayKey: 'terca' },
        { day: 'QUARTA', goal: 'Fechar as últimas 2 vagas do Content Day', dayKey: 'quarta' },
    ]
};
