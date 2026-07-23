// AGE SOCIALS — Multi-step form
const { useState: uS, useEffect: uE, useMemo, useRef: uR } = React;

const TOOL_OPTIONS = [
  'Figma', 'Photoshop', 'Illustrator', 'InDesign', 'After Effects',
  'Premiere', 'DaVinci Resolve', 'CapCut', 'Final Cut', 'Cinema 4D', 'Blender',
  'Meta Ads', 'Google Ads', 'TikTok Ads', 'GA4', 'Google Tag Manager',
  'Notion', 'Trello', 'Asana', 'ClickUp', 'Monday', 'Slack', 'Miro',
  'HubSpot', 'Pipedrive', 'RD Station',
  'Instagram', 'TikTok', 'LinkedIn', 'X', 'Discord',
  'Canva', 'ChatGPT', 'Claude',
  'Câmera DSLR/Mirrorless', 'DJI/Drone', 'Iluminação de set', 'Áudio/Rode'
];

const TOTAL_STEPS = 16;

function FormOverlay({ onClose, onFinish, withLGPD }) {
  const totalSteps = TOTAL_STEPS;
  const [step, setStep] = uS(() => {
    const saved = localStorage.getItem('age_step');
    return saved ? parseInt(saved) : 0;
  });
  const [answers, setAnswers] = uS(() => {
    const saved = localStorage.getItem('age_answers');
    const base = {
      name: '', city: '', email: '',
      linkedin: '', portfolio: '',
      experienceYears: '', experience: '',
      interests: [], tools: [],
      techLevel: '',
      style: { pace: 50, autonomy: 50, structure: 50, creative: 50, social: 50, detail: 50 },
      values: [],
      culture: '',
      learningSpeed: '', mistakeStyle: '',
      proudProject: '', mistake: '',
      routine: '', delivery: '',
      dayRate: '', fixedSalary: ''
    };
    // Merge com o que estiver salvo pra não quebrar candidaturas antigas em andamento
    return saved ? { ...base, ...JSON.parse(saved) } : base;
  });

  uE(() => {
    localStorage.setItem('age_step', step);
    localStorage.setItem('age_answers', JSON.stringify(answers));
  }, [step, answers]);

  const update = (patch) => setAnswers(a => ({ ...a, ...patch }));
  const updateStyle = (key, val) => setAnswers(a => ({ ...a, style: { ...a.style, [key]: val } }));
  const toggleArray = (field, val) => setAnswers(a => {
    const arr = a[field] || [];
    const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    return { ...a, [field]: next };
  });

  const next = () => {
    if (!canProceed) return;
    if (step < totalSteps - 1) setStep(s => s + 1);
    else {
      const result = window.calculateMatch(answers);
      localStorage.setItem('age_result', JSON.stringify(result));
      localStorage.setItem('age_candidate_name', answers.name || 'candidato');
      // v2: passa answers para o parent (necessário pro submit API na produção)
      onFinish(result, answers);
    }
  };
  const prev = () => setStep(s => Math.max(0, s - 1));

  // Validação por step
  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return answers.name.trim() && answers.city.trim() && answers.email.trim().includes('@');
      case 1: return true; // linkedin/portfolio opcionais mas encorajado
      case 2: return answers.experienceYears !== '' && answers.experience.trim().length > 20;
      case 3: return answers.interests.length > 0;
      case 4: return answers.tools.length > 0;
      case 5: return !!answers.techLevel;
      case 6: return true; // sliders de estilo
      case 7: return (answers.values || []).length > 0;
      case 8: return answers.culture.trim().length > 20;
      case 9: return !!answers.learningSpeed && !!answers.mistakeStyle;
      case 10: return answers.proudProject.trim().length > 20;
      case 11: return answers.mistake.trim().length > 20;
      case 12: return !!answers.routine;
      case 13: return !!answers.delivery;
      case 14: return !!answers.dayRate && !!answers.fixedSalary;
      case 15: return withLGPD ? !!answers.consentLGPD : true;
      default: return true;
    }
  }, [step, answers]);

  const progressPct = ((step + 1) / totalSteps) * 100;

  const stepContent = renderStep(step, answers, { update, updateStyle, toggleArray }, withLGPD);

  return (
    <div className="form-overlay" data-screen-label="Form Overlay">
      <div className="form-header">
        <div className="form-header-left">
          <div className="nav-logo" style={{color: 'var(--ink)'}}>AGE<span className="dot"></span>SOCIALS</div>
          <div className="form-progress">
            <span className="curr">{String(step + 1).padStart(2, '0')}</span> / {String(totalSteps).padStart(2, '0')}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{width: `${progressPct}%`}}></div>
          </div>
        </div>
        <button className="form-close" onClick={onClose}>Fechar ✕</button>
      </div>

      <div className="form-body">
        <div className="form-step" key={step}>
          {stepContent}
        </div>
      </div>

      <div className="form-footer">
        <button className="form-btn ghost" onClick={prev} disabled={step === 0}>← Voltar</button>
        <div className="form-footer-hint">
          {step === totalSteps - 1 ? 'Última pergunta' : 'Enter ou clique em continuar'}
        </div>
        <button className="form-btn primary" onClick={next} disabled={!canProceed}>
          {step === totalSteps - 1 ? 'Ver meu resultado →' : 'Continuar →'}
        </button>
      </div>
    </div>
  );
}

function renderStep(step, a, h, withLGPD) {
  const n = step + 1;
  const t = TOTAL_STEPS;
  switch (step) {
    case 0: return <StepIdentity a={a} h={h} n={n} t={t} />;
    case 1: return <StepLinks a={a} h={h} n={n} t={t} />;
    case 2: return <StepExperience a={a} h={h} n={n} t={t} />;
    case 3: return <StepInterests a={a} h={h} n={n} t={t} />;
    case 4: return <StepTools a={a} h={h} n={n} t={t} />;
    case 5: return <StepTechLevel a={a} h={h} n={n} t={t} />;
    case 6: return <StepStyle a={a} h={h} n={n} t={t} />;
    case 7: return <StepValues a={a} h={h} n={n} t={t} />;
    case 8: return <StepCulture a={a} h={h} n={n} t={t} />;
    case 9: return <StepLearning a={a} h={h} n={n} t={t} />;
    case 10: return <StepProud a={a} h={h} n={n} t={t} />;
    case 11: return <StepMistake a={a} h={h} n={n} t={t} />;
    case 12: return <StepRoutine a={a} h={h} n={n} t={t} />;
    case 13: return <StepDelivery a={a} h={h} n={n} t={t} />;
    case 14: return <StepPay a={a} h={h} n={n} t={t} />;
    case 15: return <StepReview a={a} h={h} n={n} t={t} withLGPD={withLGPD} />;
    default: return null;
  }
}

function StepHeader({ n, total, title, hint }) {
  return (
    <>
      <div className="step-number">Pergunta {String(n).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
      <h2 className="step-question">{title}</h2>
      {hint && <p className="step-hint">{hint}</p>}
    </>
  );
}

function StepIdentity({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Vamos começar pelo <span className="italic">básico.</span></>} hint="Nome, cidade, email. Nada de sobrenome do meio — a gente confia em você." />
      <div className="field-group">
        <div className="field">
          <label>Nome completo</label>
          <input value={a.name} onChange={e => h.update({name: e.target.value})} placeholder="Como você quer ser chamado(a)" autoFocus/>
        </div>
        <div className="field-inline">
          <div className="field">
            <label>Cidade / Estado</label>
            <input value={a.city} onChange={e => h.update({city: e.target.value})} placeholder="São Paulo / SP"/>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={a.email} onChange={e => h.update({email: e.target.value})} placeholder="voce@email.com"/>
          </div>
        </div>
      </div>
    </>
  );
}

function StepLinks({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Onde a gente <span className="italic">acha</span> seu trabalho?</>} hint="LinkedIn e portfólio. Se ainda não tem portfólio, cola drive, behance, notion, um post que você fez, qualquer coisa. Aqui é o momento de se mostrar." />
      <div className="field-group">
        <div className="field">
          <label>LinkedIn</label>
          <input value={a.linkedin} onChange={e => h.update({linkedin: e.target.value})} placeholder="linkedin.com/in/seuperfil"/>
        </div>
        <div className="field">
          <label>Portfólio, Behance, Drive, Notion (o que tiver)</label>
          <input value={a.portfolio} onChange={e => h.update({portfolio: e.target.value})} placeholder="link direto"/>
        </div>
      </div>
    </>
  );
}

function StepExperience({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Conta sua <span className="italic">história</span> profissional.</>} hint="Não precisa ser CV. Um parágrafo bom, com o que você já fez e o que te fez chegar até aqui, resolve." />
      <div className="field-group">
        <div className="field">
          <label>Anos de experiência na área</label>
          <input type="number" min="0" max="30" step="0.5" value={a.experienceYears} onChange={e => h.update({experienceYears: e.target.value})} placeholder="0.5, 2, 5..." style={{maxWidth: 200}}/>
        </div>
        <div className="field">
          <label>Sua trajetória</label>
          <textarea value={a.experience} onChange={e => h.update({experience: e.target.value})} placeholder="Onde você começou, onde passou, o que aprendeu, o que faz hoje..." rows={5}/>
        </div>
      </div>
    </>
  );
}

function StepInterests({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Quais áreas <span className="italic">te chamam?</span></>} hint="Marca uma ou várias — a gente descobre a ideal depois. Não seja tímido: se te interessa mesmo que você não domine ainda, marca." />
      <div className="chips" style={{marginTop: 8}}>
        {window.AGE_ROLES.map(r => (
          <button
            key={r.id}
            className={'chip' + (a.interests.includes(r.id) ? ' selected' : '')}
            onClick={() => h.toggleArray('interests', r.id)}
          >{r.name}</button>
        ))}
      </div>
    </>
  );
}

function StepTools({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Ferramentas que você <span className="italic">domina.</span></>} hint="Só o que você usa de verdade, não o que já abriu uma vez. Menos aqui é mais." />
      <div className="chips" style={{marginTop: 8}}>
        {TOOL_OPTIONS.map(tool => (
          <button
            key={tool}
            className={'chip' + (a.tools.includes(tool) ? ' selected' : '')}
            onClick={() => h.toggleArray('tools', tool)}
          >{tool}</button>
        ))}
      </div>
    </>
  );
}

function StepTechLevel({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Seu <span className="italic">nível técnico</span> hoje, sendo honesto(a).</>} hint="Pensa na sua área principal. Não tem resposta errada — a gente valoriza quem sabe onde está pra crescer daqui." />
      <div className="radio-list">
        {window.TECH_LEVEL_OPTIONS.map(o => (
          <button
            key={o.id}
            className={'radio-card' + (a.techLevel === o.id ? ' selected' : '')}
            onClick={() => h.update({techLevel: o.id})}
          >
            <span className="marker"></span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function StepStyle({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Seu <span className="italic">jeito</span> de trabalhar.</>} hint="Não tem resposta certa. Só o que é verdade pra você. Arrasta o slider." />
      <div>
        {window.STYLE_QUESTIONS.map(q => (
          <div key={q.key} className="slider-item">
            <div className="slider-label">{q.label}</div>
            <div className="slider-track">
              <input
                type="range" min="0" max="100" step="1"
                value={a.style[q.key]}
                onChange={e => h.updateStyle(q.key, parseInt(e.target.value))}
              />
            </div>
            <div className="slider-ends">
              <span>← {q.low}</span>
              <span>{q.high} →</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StepValues({ a, h, n, t }) {
  const sel = a.values || [];
  return (
    <>
      <StepHeader n={n} total={t} title={<>O que você mais <span className="italic">valoriza</span> num time?</>} hint="Marca de 3 a 5 que mais te representam. Isso ajuda a gente a entender seu fit cultural." />
      <div className="chips" style={{marginTop: 8}}>
        {window.VALUE_OPTIONS.map(v => (
          <button
            key={v.id}
            className={'chip' + (sel.includes(v.id) ? ' selected' : '')}
            onClick={() => h.toggleArray('values', v.id)}
          >{v.label}</button>
        ))}
      </div>
    </>
  );
}

function StepCulture({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>O que <span className="italic">não</span> pode faltar num lugar pra você trabalhar bem?</>} hint="Vale falar de cultura, postura de time, tipo de liderança, jeito de dar feedback. A gente quer entender o que te faz render." />
      <div className="field">
        <textarea value={a.culture} onChange={e => h.update({culture: e.target.value})} placeholder="Escreve com liberdade. 2-4 linhas boas resolvem." rows={6}/>
      </div>
    </>
  );
}

function StepLearning({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Como você <span className="italic">aprende</span> e <span className="italic">lida com erro?</span></>} hint="Duas escolhas rápidas. A gente valoriza gente que aprende rápido e assume o próprio erro sem drama." />
      <div style={{marginBottom: 32}}>
        <div className="field" style={{marginBottom: 14}}><label>Quando precisa aprender algo novo, você...</label></div>
        <div className="radio-list">
          {window.LEARNING_OPTIONS.map(o => (
            <button
              key={o.id}
              className={'radio-card' + (a.learningSpeed === o.id ? ' selected' : '')}
              onClick={() => h.update({learningSpeed: o.id})}
            >
              <span className="marker"></span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="field" style={{marginBottom: 14}}><label>Quando comete um erro no trabalho, você...</label></div>
        <div className="radio-list">
          {window.MISTAKE_STYLE_OPTIONS.map(o => (
            <button
              key={o.id}
              className={'radio-card' + (a.mistakeStyle === o.id ? ' selected' : '')}
              onClick={() => h.update({mistakeStyle: o.id})}
            >
              <span className="marker"></span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function StepProud({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Qual projeto você <span className="italic">se orgulha</span> de ter feito?</>} hint="Pode ser pessoal, freela, trabalho, TCC, o post que bombou. Conta o que era, seu papel e por que orgulha você." />
      <div className="field">
        <textarea value={a.proudProject} onChange={e => h.update({proudProject: e.target.value})} placeholder="Descreve o projeto e o seu papel nele." rows={6}/>
      </div>
    </>
  );
}

function StepMistake({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>E um <span className="italic">erro</span> que te ensinou algo?</>} hint="A gente valoriza gente que erra bem. Conta um erro real, o que aconteceu, e o que você aprendeu depois." />
      <div className="field">
        <textarea value={a.mistake} onChange={e => h.update({mistake: e.target.value})} placeholder="Sem verniz. Vale o erro mais recente ou o mais marcante." rows={6}/>
      </div>
    </>
  );
}

function StepRoutine({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Sua rotina <span className="italic">ideal</span> parece com...</>} hint="Escolhe a que mais se aproxima do dia em que você rende mais." />
      <div className="radio-list">
        {window.ROUTINE_OPTIONS.map(o => (
          <button
            key={o.id}
            className={'radio-card' + (a.routine === o.id ? ' selected' : '')}
            onClick={() => h.update({routine: o.id})}
          >
            <span className="marker"></span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function StepDelivery({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Em qual <span className="italic">tipo</span> de entrega você rende melhor?</>} hint="Escolhe a mais próxima. Se tiver dúvida entre duas, escolhe a que te dá menos preguiça." />
      <div className="radio-list">
        {window.DELIVERY_OPTIONS.map(o => (
          <button
            key={o.id}
            className={'radio-card' + (a.delivery === o.id ? ' selected' : '')}
            onClick={() => h.update({delivery: o.id})}
          >
            <span className="marker"></span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function StepPay({ a, h, n, t }) {
  return (
    <>
      <StepHeader n={n} total={t} title={<>Vamos falar de <span className="italic">grana.</span></>} hint="Sem constrangimento — isso ajuda a gente a alinhar a proposta certa pra você. Fica só entre a gente e o time de recrutamento." />
      <div className="field-group">
        <div className="field">
          <label>Faixa que você cobra por diária (freela)</label>
          <select value={a.dayRate} onChange={e => h.update({dayRate: e.target.value})}>
            <option value="" disabled>Selecione uma faixa</option>
            {window.PAY_DAYRATE_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Salário mensal que buscaria num trabalho fixo</label>
          <select value={a.fixedSalary} onChange={e => h.update({fixedSalary: e.target.value})}>
            <option value="" disabled>Selecione uma faixa</option>
            {window.PAY_FIXED_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

function StepReview({ a, h, n, t, withLGPD }) {
  const dayRateLabel = (window.PAY_DAYRATE_OPTIONS.find(o => o.id === a.dayRate) || {}).label;
  const fixedLabel = (window.PAY_FIXED_OPTIONS.find(o => o.id === a.fixedSalary) || {}).label;
  const techLabel = (window.TECH_LEVEL_OPTIONS.find(o => o.id === a.techLevel) || {}).label;
  return (
    <>
      <StepHeader n={n} total={t} title={<>Tudo <span className="italic">pronto.</span></>} hint="A gente vai processar suas respostas e te mostrar sua função ideal, top 3 recomendadas e senioridade sugerida. Confere se está tudo certo e segue." />
      <div style={{
        border: '1px solid var(--ink-15)', borderRadius: 12, padding: 24,
        background: 'var(--paper-warm)', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.9
      }}>
        <div><span style={{color:'var(--ink-40)'}}>nome_&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.name || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>cidade_&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.city || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>email_&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.email || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>exp_anos_&nbsp;&nbsp;</span> {a.experienceYears || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>nível_téc_&nbsp;</span> {techLabel || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>interesses_</span> {a.interests.length}</div>
        <div><span style={{color:'var(--ink-40)'}}>valores_&nbsp;&nbsp;&nbsp;</span> {(a.values || []).length}</div>
        <div><span style={{color:'var(--ink-40)'}}>tools_&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.tools.length}</div>
        <div><span style={{color:'var(--ink-40)'}}>diária_&nbsp;&nbsp;&nbsp;&nbsp;</span> {dayRateLabel || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>fixo_&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> {fixedLabel || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>portfólio_&nbsp;</span> {a.portfolio ? '✓' : 'não enviado'}</div>
      </div>
      {withLGPD && (
        <div className="lgpd-box">
          <input
            type="checkbox"
            id="consent"
            checked={!!a.consentLGPD}
            onChange={e => h.update({ consentLGPD: e.target.checked })}
          />
          <label htmlFor="consent">
            Autorizo a AGE SOCIALS a armazenar meus dados desta candidatura para fins de recrutamento por até 12 meses. Posso solicitar exclusão a qualquer momento pelo email <b>recrutamento@agesocials.com.br</b>.
          </label>
        </div>
      )}
    </>
  );
}

Object.assign(window, { FormOverlay });
