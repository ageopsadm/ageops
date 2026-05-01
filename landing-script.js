/* ══════════════════════════════════════════════
   AGE OPS Landing Page — JavaScript
══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

  /* ─────────────────────────────────────
     NAVBAR — scroll effect
  ───────────────────────────────────── */
  const navbar = document.getElementById('navbar');
  function updateNavbar() {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();

  /* ─────────────────────────────────────
     MENU MOBILE
  ───────────────────────────────────── */
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');

  navToggle.addEventListener('click', function () {
    navLinks.classList.toggle('open');
    const spans = navToggle.querySelectorAll('span');
    if (navLinks.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    }
  });

  /* Fechar menu ao clicar num link */
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      navLinks.classList.remove('open');
      const spans = navToggle.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    });
  });

  /* ─────────────────────────────────────
     SMOOTH SCROLL com offset do navbar
  ───────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ─────────────────────────────────────
     COUNTER ANIMATION (hero stats)
  ───────────────────────────────────── */
  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1800;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  /* Dispara counters quando entram na tela */
  const counterEls = document.querySelectorAll('.stat-num[data-target]');
  const counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counterEls.forEach(function (el) { counterObserver.observe(el); });

  /* ─────────────────────────────────────
     REVEAL ON SCROLL (fade-in-up)
  ───────────────────────────────────── */
  /* Adiciona classe .reveal em elementos que devem aparecer */
  const revealSelectors = [
    '.pain-card',
    '.step',
    '.diff-item',
    '.module-card',
    '.compare-row',
    '.price-card',
    '.segment-pill',
    '.faq-item',
  ];

  revealSelectors.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, i) {
      el.classList.add('reveal');
      if (i % 4 === 1) el.classList.add('reveal-delay-1');
      if (i % 4 === 2) el.classList.add('reveal-delay-2');
      if (i % 4 === 3) el.classList.add('reveal-delay-3');
    });
  });

  const revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─────────────────────────────────────
     FAQ ACCORDION
  ───────────────────────────────────── */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = this.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      /* Fechar todos */
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('open');
      });

      /* Abrir o clicado (se estava fechado) */
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ─────────────────────────────────────
     MOCKUP — animação de barra ativa
  ───────────────────────────────────── */
  const mockBars = document.querySelectorAll('.mock-bar');
  let mockBarIdx = 3;
  setInterval(function () {
    mockBars.forEach(function (b) { b.classList.remove('active'); });
    mockBarIdx = (mockBarIdx + 1) % mockBars.length;
    mockBars[mockBarIdx].classList.add('active');
  }, 2000);

  /* Animação dos itens do sidebar do mockup */
  const mockNavItems = document.querySelectorAll('.mock-nav-item');
  let mockNavIdx = 0;
  setInterval(function () {
    mockNavItems.forEach(function (n) { n.classList.remove('active'); });
    mockNavIdx = (mockNavIdx + 1) % mockNavItems.length;
    mockNavItems[mockNavIdx].classList.add('active');
  }, 3000);

  /* ─────────────────────────────────────
     ACTIVE NAV LINK on scroll
  ───────────────────────────────────── */
  const sections = document.querySelectorAll('section[id]');
  const navLinkEls = document.querySelectorAll('.nav-links a[href^="#"]');

  const sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        navLinkEls.forEach(function (a) { a.style.color = ''; });
        const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if (active && !active.classList.contains('btn-nav')) {
          active.style.color = 'var(--acc)';
        }
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(function (s) { sectionObserver.observe(s); });

  /* ─────────────────────────────────────
     FORM SUBMIT
  ───────────────────────────────────── */
  window.submitForm = function (e) {
    e.preventDefault();
    const btn  = document.getElementById('submitBtn');
    const txt  = document.getElementById('submitText');
    const form = document.getElementById('contactForm');
    const succ = document.getElementById('formSuccess');

    /* Validação básica */
    const name    = document.getElementById('fName').value.trim();
    const company = document.getElementById('fCompany').value.trim();
    const phone   = document.getElementById('fPhone').value.trim();

    if (!name || !company || !phone) {
      shakeBtn(btn);
      return;
    }

    /* Loading state */
    btn.disabled = true;
    txt.textContent = 'Enviando...';
    btn.style.opacity = '.7';

    /* Simula envio (substitua por fetch real quando tiver backend) */
    setTimeout(function () {
      form.style.display = 'none';
      succ.classList.add('visible');

      /* Envia para WhatsApp como fallback */
      const plano = document.querySelector('input[name="plano"]:checked')?.value || 'não informado';
      const msg = document.querySelector('#fMessage')?.value || '';
      const seg  = document.getElementById('fSegment')?.value || 'não informado';
      const waMes = encodeURIComponent(
        `Olá! Vi a landing page da AGE OPS e tenho interesse.\n\n` +
        `Nome: ${name}\nEmpresa: ${company}\nWhatsApp: ${phone}\n` +
        `Segmento: ${seg}\nPlano de interesse: ${plano}\n\n` +
        (msg ? `Desafio: ${msg}` : '')
      );
      /* Abre WhatsApp após 1.5s */
      setTimeout(function () {
        window.open(`https://wa.me/5511999999999?text=${waMes}`, '_blank');
      }, 1500);
    }, 1800);
  };

  function shakeBtn(el) {
    el.style.animation = 'none';
    el.style.transform = 'translateX(-6px)';
    setTimeout(function () { el.style.transform = 'translateX(6px)'; }, 80);
    setTimeout(function () { el.style.transform = 'translateX(-4px)'; }, 160);
    setTimeout(function () { el.style.transform = 'translateX(4px)'; }, 240);
    setTimeout(function () { el.style.transform = ''; }, 320);
  }

  /* ─────────────────────────────────────
     TYPED TEXT no hero (opcional)
  ───────────────────────────────────── */
  /* Partícula/grid hover effect leve */
  const heroEl = document.querySelector('.hero-grid');
  if (heroEl) {
    document.querySelector('.hero')?.addEventListener('mousemove', function (e) {
      const x = (e.clientX / window.innerWidth  - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      heroEl.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  /* ─────────────────────────────────────
     PLAN SELECTOR — highlight card ao selecionar radio
  ───────────────────────────────────── */
  document.querySelectorAll('.radio-option').forEach(function (label) {
    label.addEventListener('click', function () {
      document.querySelectorAll('.radio-option').forEach(function (l) {
        l.style.borderColor = '';
        l.style.color = '';
        l.style.background = '';
      });
      this.style.borderColor = 'rgba(245,158,11,.5)';
      this.style.color       = 'var(--acc)';
      this.style.background  = 'var(--acc-dim)';
    });
  });

  /* Inicializa o selecionado por padrão */
  const defaultRadio = document.querySelector('.radio-option input[checked], input[name="plano"][value="growth"]');
  if (defaultRadio) {
    const parentLabel = defaultRadio.closest('.radio-option');
    if (parentLabel) {
      parentLabel.style.borderColor = 'rgba(245,158,11,.5)';
      parentLabel.style.color       = 'var(--acc)';
      parentLabel.style.background  = 'var(--acc-dim)';
    }
  }

  /* ─────────────────────────────────────
     MASCARAR TELEFONE
  ───────────────────────────────────── */
  const phoneInput = document.getElementById('fPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 10) {
        v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (v.length > 6) {
        v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      } else {
        v = v.replace(/(\d*)/, '($1');
      }
      this.value = v;
    });
  }

  console.log('[AGE OPS] Landing carregada com sucesso ✅');
});
