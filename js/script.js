/* Recorte automático da margem transparente dos PNGs do header (logo e Instagram).
   Mede onde o desenho realmente começa e termina e ajusta --trim/--tx/--ty.
   Precisa que a página rode por servidor (ex.: Live Server); abrindo o arquivo direto (file://)
   o navegador bloqueia e o CSS usa o valor reserva. */
const trimCache = new Map();
const TRIM_SEL = '.brand img, .icon-btn img, .drawer__btn img';

function measureTrim(img) {
  const src = img.currentSrc || img.src;
  if (trimCache.has(src)) return trimCache.get(src);
  let r = null;
  try {
    const k = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.max(1, Math.round(img.naturalWidth * k));
    const H = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= 0) {
      r = {
        f: W / (x1 - x0 + 1),
        tx: (x0 + x1 + 1) / 2 / W - 0.5,
        ty: (y0 + y1 + 1) / 2 / H - 0.5
      };
    }
  } catch (e) { /* file:// ou imagem bloqueada: usa o valor reserva do CSS */ }
  trimCache.set(src, r);
  return r;
}

function applyTrim(img) {
  if (!img.complete || !img.naturalWidth) return;
  const r = measureTrim(img);
  if (!r) return;
  img.style.setProperty('--trim', r.f.toFixed(4));
  img.style.setProperty('--tx', r.tx.toFixed(4));
  img.style.setProperty('--ty', r.ty.toFixed(4));
}

function trimAll() {
  document.querySelectorAll(TRIM_SEL).forEach(img => {
    if (img.complete) applyTrim(img);
    else img.addEventListener('load', () => applyTrim(img), { once: true });
  });
}

trimAll();
addEventListener('load', trimAll);
/* o menu lateral é criado depois: aplica o recorte nos ícones dele também */
new MutationObserver(trimAll).observe(document.body, { childList: true, subtree: true });


/* Animação de entrada: os elementos aparecem conforme a página é rolada.
   Cada grupo = [seletor, tipo (up, down, left, right, zoom, fade), atraso entre itens, atraso inicial] em segundos.
   Se o visitante prefere menos movimento, nada é escondido nem animado. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const groups = [
    ['.topbar > *',        'down',  .08, 0],
    ['.s-hero__license',   'left',  0,   .2],
    ['.s-hero__text > *',  'right', .14, .3],
    ['.s-title',           'up',    0,   0],
    ['.tl-card',           'up',    0,   .05],
    ['.how__item',         'up',    .1,  .1],
    ['.why h2',            'up',    0,   0],
    ['.why p',             'up',    0,   .15],
    ['.why__shark--l',     'left',  0,   .1],
    ['.why__shark--r',     'right', 0,   .1],
    ['.ast',               'zoom',  0,   .2]
  ];

  const items = [];
  groups.forEach(([sel, type, step, base]) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.setAttribute('data-reveal', type);
      const d = base + i * step;
      el.style.setProperty('--d', d + 's');
      items.push([el, d]);
    });
  });

  document.documentElement.classList.add('js-reveal');
  void document.body.offsetHeight;   // fixa o estado inicial (escondido) antes de começar a animar

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      io.unobserve(el);
      el.classList.add('is-in');
      const d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      // depois que termina, devolve o elemento ao CSS normal (hover, transições próprias)
      setTimeout(() => {
        el.removeAttribute('data-reveal');
        el.classList.remove('is-in');
        el.style.removeProperty('--d');
      }, (d + 1.1) * 1000);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

  items.forEach(([el]) => io.observe(el));
})();


/* ==========================================================
   Menu lateral (sidebar) para tablet e celular
   Montado a partir do próprio menu do cabeçalho: se você mudar os links
   no HTML, o menu lateral acompanha sozinho. Funciona em todas as páginas.
   Abaixo de 1000px o menu normal some e aparece o botão de 3 risquinhas.
   ========================================================== */
(function () {
  const topbar = document.querySelector('.topbar');
  const nav = topbar && topbar.querySelector('.nav');
  if (!topbar || !nav) return;

  const mq = matchMedia('(min-width: 1001px)');

  /* botão (3 risquinhas) no cabeçalho */
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'menu-toggle';
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'drawer');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  topbar.appendChild(toggle);

  /* painel lateral */
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('inert', '');
  drawer.innerHTML = `
    <div class="drawer__backdrop" data-close></div>
    <aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" class="drawer__close" data-close aria-label="Fechar menu">×</button>
      <nav class="drawer__nav" aria-label="Menu lateral"></nav>
      <div class="drawer__social"></div>
    </aside>`;
  document.body.appendChild(drawer);

  const drawerNav = drawer.querySelector('.drawer__nav');
  const social = drawer.querySelector('.drawer__social');

  nav.querySelectorAll('a').forEach((a, i) => {
    const l = document.createElement('a');
    l.href = a.getAttribute('href');
    l.textContent = a.textContent.trim();
    l.style.setProperty('--i', i);
    l.dataset.href = a.getAttribute('href');
    drawerNav.appendChild(l);
  });

  topbar.querySelectorAll('.icon-btn').forEach(a => {
    const b = document.createElement('a');
    b.className = 'drawer__btn';
    b.href = a.getAttribute('href');
    b.setAttribute('aria-label', a.getAttribute('aria-label') || '');
    const img = a.querySelector('img');
    if (img) { const c = document.createElement('img'); c.src = img.getAttribute('src'); c.alt = ''; b.appendChild(c); }
    const nome = document.createElement('span');          // nome ao lado do ícone (WhatsApp, Instagram)
    nome.textContent = a.getAttribute('aria-label') || '';
    b.appendChild(nome);
    social.appendChild(b);
  });

  /* copia o item ativo do menu do cabeçalho (na home ele muda ao rolar) */
  function syncActive() {
    const act = nav.querySelector('a.is-active');
    drawerNav.querySelectorAll('a').forEach(l => {
      const on = !!act && l.dataset.href === act.getAttribute('href');
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
  }

  function abrir() {
    syncActive();
    drawer.removeAttribute('inert');
    drawer.classList.add('is-open');
    document.documentElement.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    drawer.querySelector('.drawer__close').focus({ preventScroll: true });
  }

  function fechar(devolverFoco = true) {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('inert', '');
    document.documentElement.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (devolverFoco) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', abrir);
  drawer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) fechar();
    else if (e.target.closest('.drawer__nav a')) fechar(false);   // o link continua e rola até a seção
  });

  addEventListener('keydown', e => {
    if (!drawer.classList.contains('is-open')) return;
    if (e.key === 'Escape') { fechar(); return; }
    if (e.key === 'Tab') {                  // mantém o foco dentro do painel
      const f = [...drawer.querySelectorAll('button, a[href]')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* se a tela crescer até o desktop, fecha o painel */
  mq.addEventListener('change', e => { if (e.matches) fechar(false); });
})();


/* ==========================================================
   Como eu trabalho: ao clicar numa etapa abre um pop-up com o texto dela.
   O texto vem do próprio HTML (div.how__more dentro de cada etapa), então é só editar lá.
   Setas do teclado trocam de etapa, Esc ou clique fora fecham.
   ========================================================== */
(function () {
  const dlg = document.getElementById('step');
  const items = [...document.querySelectorAll('button.how__item')];
  if (!dlg || !items.length || typeof dlg.showModal !== 'function') return;

  const data = items.map(b => ({
    title: b.querySelector('span').textContent.trim(),
    icon: (b.querySelector('img') || {}).src || '',
    text: ((b.parentElement.querySelector('.how__more p') || {}).textContent || '').trim()
  }));

  dlg.setAttribute('aria-labelledby', 'step-title');
  dlg.innerHTML = `
    <div class="step__card">
      <button type="button" class="step__close" aria-label="Fechar">×</button>
      <div class="step__body">
        <div class="step__bar"><span class="step__num"></span></div>
        <div class="step__head">
          <span class="step__tile"><img class="step__icon" alt=""></span>
          <h3 id="step-title"></h3>
        </div>
        <p class="step__text"></p>
      </div>
      <div class="step__foot">
        <div class="step__dots"></div>
        <div class="step__arrows">
          <button type="button" class="step__arrow" data-dir="-1" aria-label="Etapa anterior">←</button>
          <button type="button" class="step__arrow" data-dir="1" aria-label="Próxima etapa">→</button>
        </div>
      </div>
    </div>`;

  const body = dlg.querySelector('.step__body');
  const dots = dlg.querySelector('.step__dots');
  data.forEach((d, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'step__dot';
    dot.setAttribute('aria-label', d.title);
    dot.addEventListener('click', () => show(i));
    dots.appendChild(dot);
  });

  let cur = 0;
  function show(i, animate = true) {
    cur = (i + data.length) % data.length;
    const d = data[cur];
    dlg.querySelector('.step__num').textContent = 'Etapa ' + (cur + 1) + ' de ' + data.length;
    const ic = dlg.querySelector('.step__icon');
    ic.src = d.icon;
    ic.parentElement.style.display = d.icon ? '' : 'none';
    dlg.querySelector('#step-title').textContent = d.title;
    dlg.querySelector('.step__text').textContent = d.text;
    dots.querySelectorAll('.step__dot').forEach((x, k) => {
      x.classList.toggle('is-on', k === cur);
      if (k === cur) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
    });
    if (animate) { body.style.animation = 'none'; void body.offsetHeight; body.style.animation = ''; }
  }

  items.forEach((b, i) => b.addEventListener('click', () => {
    show(i, false);
    dlg.showModal();
    document.documentElement.classList.add('step-open');
  }));

  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('.step__close')) dlg.close();
    const arrow = e.target.closest('.step__arrow');
    if (arrow) show(cur + Number(arrow.dataset.dir));
  });

  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(cur + 1);
    else if (e.key === 'ArrowLeft') show(cur - 1);
  });

  dlg.addEventListener('close', () => document.documentElement.classList.remove('step-open'));
})();

const msg = "Olá Min, vim pelo seu portfólio! Gostaria de mais informações.";
document.getElementById("zap").href =
  "https://wa.me/5511965270351?text=" + encodeURIComponent(msg);