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

function FormOverlay({ onClose, onFinish, withLGPD }) {
  const totalSteps = 12;
  const [step, setStep] = uS(() => {
    const saved = localStorage.getItem('age_step');
    return saved ? parseInt(saved) : 0;
  });
  const [answers, setAnswers] = uS(() => {
    const saved = localStorage.getItem('age_answers');
    return saved ? JSON.parse(saved) : {
      name: '', city: '', email: '',
      linkedin: '', portfolio: '',
      experienceYears: '', experience: '',
      interests: [], tools: [],
      style: { pace: 50, autonomy: 50, structure: 50, creative: 50, social: 50, detail: 50 },
      culture: '', proudProject: '', mistake: '',
      routine: '', delivery: ''
    };
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
      case 5: return true;
      case 6: return answers.culture.trim().length > 20;
      case 7: return answers.proudProject.trim().length > 20;
      case 8: return answers.mistake.trim().length > 20;
      case 9: return !!answers.routine;
      case 10: return !!answers.delivery;
      case 11: return withLGPD ? !!answers.consentLGPD : true;
      default: return true;
    }
  }, [step, answers]);

  const progressPct = ((step + 1) / totalSteps) * 100;

  const stepContent = renderStep(step, answers, { update, updateStyle, toggleArray });

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
        <div style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-40)', letterSpacing:'0.1em', textTransform:'uppercase'}}>
          {step === totalSteps - 1 ? 'Última pergunta' : 'Enter ou clique em continuar'}
        </div>
        <button className="form-btn primary" onClick={next} disabled={!canProceed}>
          {step === totalSteps - 1 ? 'Ver meu resultado →' : 'Continuar →'}
        </button>
      </div>
    </div>
  );
}

function renderStep(step, a, h) {
  switch (step) {
    case 0: return <StepIdentity a={a} h={h} />;
    case 1: return <StepLinks a={a} h={h} />;
    case 2: return <StepExperience a={a} h={h} />;
    case 3: return <StepInterests a={a} h={h} />;
    case 4: return <StepTools a={a} h={h} />;
    case 5: return <StepStyle a={a} h={h} />;
    case 6: return <StepCulture a={a} h={h} />;
    case 7: return <StepProud a={a} h={h} />;
    case 8: return <StepMistake a={a} h={h} />;
    case 9: return <StepRoutine a={a} h={h} />;
    case 10: return <StepDelivery a={a} h={h} />;
    case 11: return <StepReview a={a} h={h} withLGPD={withLGPD} />;
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

function StepIdentity({ a, h }) {
  return (
    <>
      <StepHeader n={1} total={12} title={<>Vamos começar pelo <span className="italic">básico.</span></>} hint="Nome, cidade, email. Nada de sobrenome do meio — a gente confia em você." />
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

function StepLinks({ a, h }) {
  return (
    <>
      <StepHeader n={2} total={12} title={<>Onde a gente <span className="italic">acha</span> seu trabalho?</>} hint="LinkedIn e portfólio. Se ainda não tem portfólio, cola drive, behance, notion, um post que você fez, qualquer coisa. Aqui é o momento de se mostrar." />
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

function StepExperience({ a, h }) {
  return (
    <>
      <StepHeader n={3} total={12} title={<>Conta sua <span className="italic">história</span> profissional.</>} hint="Não precisa ser CV. Um parágrafo bom, com o que você já fez e o que te fez chegar até aqui, resolve." />
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

function StepInterests({ a, h }) {
  return (
    <>
      <StepHeader n={4} total={12} title={<>Quais áreas <span className="italic">te chamam?</span></>} hint="Marca uma ou várias — a gente descobre a ideal depois. Não seja tímido: se te interessa mesmo que você não domine ainda, marca." />
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

function StepTools({ a, h }) {
  return (
    <>
      <StepHeader n={5} total={12} title={<>Ferramentas que você <span className="italic">domina.</span></>} hint="Só o que você usa de verdade, não o que já abriu uma vez. Menos aqui é mais." />
      <div className="chips" style={{marginTop: 8}}>
        {TOOL_OPTIONS.map(t => (
          <button
            key={t}
            className={'chip' + (a.tools.includes(t) ? ' selected' : '')}
            onClick={() => h.toggleArray('tools', t)}
          >{t}</button>
        ))}
      </div>
    </>
  );
}

function StepStyle({ a, h }) {
  return (
    <>
      <StepHeader n={6} total={12} title={<>Seu <span className="italic">jeito</span> de trabalhar.</>} hint="Não tem resposta certa. Só o que é verdade pra você. Arrasta o slider." />
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

function StepCulture({ a, h }) {
  return (
    <>
      <StepHeader n={7} total={12} title={<>O que <span className="italic">não</span> pode faltar num lugar pra você trabalhar bem?</>} hint="Vale falar de cultura, postura de time, tipo de liderança, jeito de dar feedback. A gente quer entender o que te faz render." />
      <div className="field">
        <textarea value={a.culture} onChange={e => h.update({culture: e.target.value})} placeholder="Escreve com liberdade. 2-4 linhas boas resolvem." rows={6}/>
      </div>
    </>
  );
}

function StepProud({ a, h }) {
  return (
    <>
      <StepHeader n={8} total={12} title={<>Qual projeto você <span className="italic">se orgulha</span> de ter feito?</>} hint="Pode ser pessoal, freela, trabalho, TCC, o post que bombou. Conta o que era, seu papel e por que orgulha você." />
      <div className="field">
        <textarea value={a.proudProject} onChange={e => h.update({proudProject: e.target.value})} placeholder="Descreve o projeto e o seu papel nele." rows={6}/>
      </div>
    </>
  );
}

function StepMistake({ a, h }) {
  return (
    <>
      <StepHeader n={9} total={12} title={<>E um <span className="italic">erro</span> que te ensinou algo?</>} hint="A gente valoriza gente que erra bem. Conta um erro real, o que aconteceu, e o que você aprendeu depois." />
      <div className="field">
        <textarea value={a.mistake} onChange={e => h.update({mistake: e.target.value})} placeholder="Sem verniz. Vale o erro mais recente ou o mais marcante." rows={6}/>
      </div>
    </>
  );
}

function StepRoutine({ a, h }) {
  return (
    <>
      <StepHeader n={10} total={12} title={<>Sua rotina <span className="italic">ideal</span> parece com...</>} hint="Escolhe a que mais se aproxima do dia em que você rende mais." />
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

function StepDelivery({ a, h }) {
  return (
    <>
      <StepHeader n={11} total={12} title={<>Em qual <span className="italic">tipo</span> de entrega você rende melhor?</>} hint="Escolhe a mais próxima. Se tiver dúvida entre duas, escolhe a que te dá menos preguiça." />
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

function StepReview({ a, h, withLGPD }) {
  return (
    <>
      <StepHeader n={12} total={12} title={<>Tudo <span className="italic">pronto.</span></>} hint="A gente vai processar suas respostas e te mostrar sua função ideal, top 3 recomendadas e senioridade sugerida. Confere se está tudo certo e segue." />
      <div style={{
        border: '1px solid var(--ink-15)', borderRadius: 12, padding: 24,
        background: 'var(--paper-warm)', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.9
      }}>
        <div><span style={{color:'var(--ink-40)'}}>nome_&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.name || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>cidade_&nbsp;&nbsp;&nbsp;</span> {a.city || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>email_&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.email || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>exp_anos_&nbsp;</span> {a.experienceYears || '—'}</div>
        <div><span style={{color:'var(--ink-40)'}}>interesses</span> {a.interests.length}</div>
        <div><span style={{color:'var(--ink-40)'}}>tools_&nbsp;&nbsp;&nbsp;&nbsp;</span> {a.tools.length}</div>
        <div><span style={{color:'var(--ink-40)'}}>portfólio_</span> {a.portfolio ? '✓' : 'não enviado'}</div>
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
