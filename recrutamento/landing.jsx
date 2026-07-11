// AGE SOCIALS — Landing sections
const { useState, useEffect, useRef } = React;

function Nav({ onApply }) {
  return (
    <nav className="nav">
      <div className="nav-logo">AGE<span className="dot"></span>SOCIALS</div>
      <div className="nav-right">
        <span>Recrutamento 2026</span>
        <button className="nav-cta" onClick={onApply}>Aplicar →</button>
      </div>
    </nav>
  );
}

function Hero({ onApply }) {
  return (
    <section className="hero" data-screen-label="01 Hero">
      <div className="hero-top">
        <span>[ AGE / SOCIALS — RECRUTAMENTO ]</span>
        <span className="badge"><span className="pulse"></span> 12 VAGAS ABERTAS</span>
        <span>ROLE PARA APLICAR ↓</span>
      </div>

      <h1 className="hero-headline">
        Talvez você <span className="italic">seja</span><br/>
        um <span className="marker">de nós.</span>
      </h1>

      <div className="hero-bottom">
        <div>
          <div className="col-label">01 — O que é isto</div>
          <p>Uma candidatura única pra todas as funções da AGE. Você responde, a gente descobre onde você rende melhor.</p>
        </div>
        <div>
          <div className="col-label">02 — Quanto leva</div>
          <p>Cerca de 8 minutos, se você não escrever pouco. E a gente pede pra você não escrever pouco.</p>
        </div>
        <div>
          <div className="col-label">03 — O que você recebe</div>
          <p>Ao final, um resultado com sua função ideal, top 3 recomendadas e senioridade sugerida.</p>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="section about" data-screen-label="02 Sobre">
      <div className="section-inner">
        <div className="section-label">Sobre a AGE</div>
        <div className="about-grid">
          <div>
            <p className="about-lead">
              Somos uma agência de social <span className="italic">obcecada</span> por marca, ritmo e craft.
              A gente entrega o que a maioria promete: presença digital que não parece agência.
            </p>
          </div>
          <div className="about-body">
            <p><strong>Não somos pra todo mundo.</strong> A gente trabalha rápido, exige repertório e cobra padrão. Em troca, você trabalha com marcas que confiam de verdade, num time pequeno onde o que você faz aparece.</p>
            <p>Se você lê feed antes de ler jornal, se anota referência no meio do rolê, se acha que "tá bom" é a maior mentira do mundo — você tá no lugar certo.</p>
            <p><strong>Aqui a régua sobe.</strong> Vem junto.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RolesGrid({ onApply }) {
  return (
    <section className="section roles-section" data-screen-label="03 Vagas">
      <div className="section-inner">
        <div className="section-label">As vagas</div>
        <div className="roles-header">
          <h2 className="section-title">Estamos<br/><span className="italic">contratando.</span></h2>
          <div className="roles-count">12 posições · abertas agora · candidatura única</div>
        </div>
        <div className="roles-grid">
          {window.AGE_ROLES.map(role => (
            <div key={role.id} className="role-card" onClick={onApply}>
              <div className="role-head">
                <span>{role.number}</span>
                <span className="role-status"><span className="dot"></span>ABERTA</span>
              </div>
              <div className="role-arrow">↗</div>
              <div style={{marginTop: 'auto'}}>
                <div className="role-name">{role.name}</div>
                <div className="role-tagline" style={{marginTop: 8}}>{role.tagline}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    { n: '01', title: 'Você aplica', body: 'Responde o formulário único. Uma vez. Vale pra todas as vagas.' },
    { n: '02', title: 'A gente lê', body: 'Todo mundo é lido. A gente responde em até 10 dias úteis, mesmo pra dizer não.' },
    { n: '03', title: 'Papo real', body: 'Se der match, chamamos pra conversar. Não é entrevista com pegadinha, é papo.' },
    { n: '04', title: 'Case rápido', body: 'Uma entrega curta pra ver como você pensa. Remunerada se passar de 4h.' },
  ];
  return (
    <section className="section process" data-screen-label="04 Processo">
      <div className="section-inner">
        <div className="section-label">Como funciona</div>
        <h2 className="section-title">Sem <span className="italic">enrolação.</span></h2>
        <div className="process-list">
          {steps.map(s => (
            <div key={s.n} className="process-item">
              <div className="step">{s.n} / 04</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTAFinal({ onApply }) {
  return (
    <section className="cta-final" data-screen-label="05 CTA">
      <h2>
        Pronto pra <span className="italic">virar</span><br/>
        <span className="marker">AGE?</span>
      </h2>
      <button className="cta-btn" onClick={onApply}>
        Começar minha candidatura
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div>© AGE SOCIALS · 2026</div>
      <div>Recrutamento aberto · candidatura única</div>
      <div>São Paulo · Remoto Brasil</div>
    </footer>
  );
}

Object.assign(window, { Nav, Hero, About, RolesGrid, Process, CTAFinal, Footer });
