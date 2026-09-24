// AGE SOCIALS — Result screen
function ResultScreen({ result, candidateName, submitting, saveError, onRetrySave, onRestart, onBackHome }) {
  const { topRole, top3, scores, seniority, message } = result || {};
  const safeTop3 = Array.isArray(top3) ? top3 : [];
  const safeScores = scores || { overall: 0, cultural: 0, technical: 0 };

  return (
    <div style={{minHeight:'100vh', background:'var(--paper)'}} data-screen-label="Resultado">
      <div className="form-header">
        <div className="form-header-left">
          <div className="nav-logo" style={{color:'var(--ink)'}}>AGE<span className="dot"></span>SOCIALS</div>
          <div className="form-progress"><span className="curr">RESULTADO</span> · CANDIDATURA 2026</div>
        </div>
        <button className="form-close" onClick={onBackHome}>Voltar ao início ✕</button>
      </div>

      <div className="result-screen">
        <div className="result-eyebrow">
          {candidateName ? `${candidateName.split(' ')[0].toUpperCase()} · MATCH ANALISADO` : 'CANDIDATURA ANALISADA'}
        </div>

        <div className="result-headline">A sua função ideal na AGE é</div>
        <h1 className="result-role">{topRole?.name || '—'}</h1>

        <div className="result-meta">
          <div className="result-meta-block">
            <div className="lbl">Senioridade sugerida</div>
            <div className="val">{seniority}</div>
            <div className="desc">{message}</div>
          </div>
          <div className="result-meta-block">
            <div className="lbl">Sobre a função</div>
            <div className="val" style={{fontSize: 22, lineHeight: 1.3}}>{topRole?.description || '—'}</div>
          </div>
        </div>

        <div className="scores">
          <ScoreBlock label="Score Geral" value={safeScores.overall} />
          <ScoreBlock label="Score Cultural" value={safeScores.cultural} />
          <ScoreBlock label="Score Técnico" value={safeScores.technical} />
        </div>

        <div className="top3-section">
          <h3>Suas top 3 funções recomendadas</h3>
          <div className="top3-list">
            {safeTop3.map((item, i) => (
              <div key={(item.role && item.role.id) || i} className="top3-item">
                <div className="top3-rank">{String(i + 1).padStart(2, '0')} / 03</div>
                <div>
                  <div className="top3-name">{(item.role && item.role.name) || '—'}</div>
                </div>
                <div className="top3-desc" style={{maxWidth: 300}}>{(item.role && item.role.tagline) || ''}</div>
                <div className="top3-match">{item.match}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="result-cta">
          <div className="result-cta-text">
            Pronto pra virar <span className="italic">AGE?</span> A gente cuida do resto.
          </div>
          {saveError && (
            <div style={{marginBottom: 16, color: '#d64545', fontSize: 14, lineHeight: 1.4}}>
              {saveError}
            </div>
          )}
          <div className="result-actions">
            <button
              className="primary"
              disabled={submitting}
              onClick={() => {
                if (saveError && onRetrySave) { onRetrySave(); return; }
                alert(submitting ? 'Enviando ainda...' : 'Sua candidatura já foi salva. Você recebe retorno em até 10 dias úteis no email cadastrado.');
              }}
            >
              {submitting ? 'Enviando...' : (saveError ? 'Tentar salvar de novo' : 'Candidatura enviada ✓')}
            </button>
            <button className="ghost" onClick={onRestart}>Refazer</button>
          </div>
        </div>

        <div style={{
          marginTop: 60, paddingTop: 40, borderTop: '1px solid var(--ink-15)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-40)',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap: 12
        }}>
          <span>AGE SOCIALS · RECRUTAMENTO 2026</span>
          <span>PROCESSADO EM {new Date().toLocaleDateString('pt-BR')}</span>
          <span>ID: {(Math.random().toString(36).slice(2, 10)).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({ label, value }) {
  return (
    <div className="score-block">
      <div className="lbl">{label}</div>
      <div className="num">
        <AnimatedNumber value={value} />
        <span className="pct">%</span>
      </div>
      <div className="bar"><div className="bar-fill" style={{width: `${value}%`}}></div></div>
    </div>
  );
}

function AnimatedNumber({ value }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const duration = 1200;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{n}</span>;
}

Object.assign(window, { ResultScreen });
