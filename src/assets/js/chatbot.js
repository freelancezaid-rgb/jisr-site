/* =====================================================================
   Assistant JISR — chatbot à questions-réponses préparées (sans IA).
   - Les réponses viennent uniquement de /chatbot/faq.<langue>.json,
     modifiable depuis /admin (collection « Assistant (FAQ du chatbot) »).
   - Aucune donnée n'est envoyée nulle part : tout se passe dans le navigateur.
   ===================================================================== */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-faq]');
  if (!script) return;

  var FAQ_URL = script.getAttribute('data-faq');
  var IMG = script.getAttribute('data-img') || '/assets/img/';
  var LABEL_OPEN = script.getAttribute('data-open') || 'Assistant';
  var TEASER = script.getAttribute('data-teaser') || '';
  var LANG = (document.documentElement.lang || 'fr').slice(0, 2);
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------------
     1. MOTEUR DE RECONNAISSANCE
     ------------------------------------------------------------------ */
  var STOP_RAW = {
    fr: 'le la les l un une des de du d et ou est ce c qui que qu quoi quel quelle quels quelles a au aux en dans sur pour par avec sans je j tu il elle on nous vous ils elles me m mon ma mes te t ton ta tes se s sa son ses votre vos notre nos ne n pas plus y ai as avez ont sont suis es etes etre avoir faut peut puis peux veux veut voudrais souhaite comment cet cette ces si mais donc car ni aussi tres bien svp merci',
    en: 'the a an of to in on for and or is are was were be been am i you he she we they me my your our it its this that these those with about from at by as do does did can could would will shall should have has had not no what who whom how there their them us please',
    ar: 'في من على الى عن هل ما ماذا كيف هو هي هذا هذه هذي ذلك انا انت انتم نحن هم و او ان كان كانت كل مع بعد قبل ثم لا لم لن قد يا اي ايه ذات هناك التي الذي الذين اذا اذ حتى ام'
  };
  var STOP = {};
  (STOP_RAW[LANG] || STOP_RAW.fr).split(' ').forEach(function (w) { STOP[w] = 1; });
  var BRAND = { jisr: 1, 'جسر': 1 };

  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase().replace(/[’‘`´]/g, "'");
    try { s = s.normalize('NFD'); } catch (e) { /* ancien navigateur */ }
    s = s.replace(/[\u0300-\u036f]/g, '');
    if (LANG === 'ar') {
      s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '')
           .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
           .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
    }
    try { s = s.replace(/[^\p{L}\p{N}]+/gu, ' '); } catch (e) { s = s.replace(/[^a-z0-9\u0600-\u06FF]+/g, ' '); }
    return s.replace(/\s+/g, ' ').trim();
  }

  function stem(t) {
    if (LANG === 'ar') {
      if (t.length > 4) t = t.replace(/^(وال|بال|كال|فال|لل|ال)/, '');
      if (t.length > 4) t = t.replace(/(ات|ون|ين|ان|ها|هم|كم|نا)$/, '');
      if (t.length > 3) t = t.replace(/(ه|ي)$/, '');
      return t;
    }
    if (t.length > 3) t = t.replace(/(s|x)$/, '');
    if (LANG === 'en' && t.length > 4) t = t.replace(/(ing|ed)$/, '');
    return t;
  }

  function tokens(str, dropStops) {
    var out = [];
    norm(str).split(' ').forEach(function (t) {
      if (!t || t.length < 2 && !/[\u0600-\u06FF]/.test(t)) return;
      if (dropStops && STOP[t]) return;
      out.push(stem(t));
    });
    return out;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = cur[0];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function commonPrefix(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a.charAt(i) === b.charAt(i)) i++;
    return i;
  }

  var INDEX = [];
  function buildIndex(items) {
    INDEX = items.map(function (it) {
      var kw = {}, qt = {}, nv = [];
      (it.keywords || []).forEach(function (k) { tokens(k, false).forEach(function (t) { kw[t] = 1; }); });
      [it.question].concat(it.variants || []).forEach(function (v) {
        var n = norm(v); if (n) nv.push(n);
        tokens(v, true).forEach(function (t) { qt[t] = 1; });
      });
      return { raw: it, kw: kw, kwList: Object.keys(kw), qt: qt, qtList: Object.keys(qt), nv: nv };
    });
  }

  function fuzzyScore(t, e) {
    if (t.length < 4) return 0;
    var best = 0, i, k, minLev = LANG === 'ar' ? 6 : 5, thr = t.length >= 11 ? 2 : (t.length >= minLev ? 1 : 0), cp;
    for (i = 0; i < e.kwList.length; i++) {
      k = e.kwList[i]; if (k.length < 4) continue;
      cp = commonPrefix(t, k);
      if (cp >= 6 || (cp >= 5 && cp >= Math.min(t.length, k.length) - 1)) { best = Math.max(best, 1.6); continue; }
      if (thr && lev(t, k, thr) <= thr) best = Math.max(best, 3);
    }
    if (best) return best;
    for (i = 0; i < e.qtList.length; i++) {
      k = e.qtList[i]; if (k.length < 4) continue;
      cp = commonPrefix(t, k);
      if (cp >= 6 || (cp >= 5 && cp >= Math.min(t.length, k.length) - 1)) best = Math.max(best, 0.9);
    }
    return best;
  }

  function tokenScore(t, e) {
    if (e.kw[t]) return 3;
    if (e.qt[t]) return 1.2;
    return fuzzyScore(t, e);
  }

  function match(query) {
    var q = norm(query);
    if (q.length < 2) return { status: 'short' };
    var padded = ' ' + q + ' ';
    var qtoks = tokens(query, true);
    var scored = INDEX.map(function (e) {
      var s = 0, phrase = 0;
      e.nv.forEach(function (v) {
        if (q === v) phrase = Math.max(phrase, 10);
        else if (v.length >= 5 && padded.indexOf(' ' + v + ' ') > -1) phrase = Math.max(phrase, 7);
        else if (q.length >= 8 && (' ' + v + ' ').indexOf(padded) > -1) phrase = Math.max(phrase, 4);
      });
      s += phrase;
      var seen = {};
      qtoks.forEach(function (t) {
        if (seen[t]) return; seen[t] = 1;
        var w = BRAND[t] ? 0.4 : 1;
        var sc = tokenScore(t, e);
        // arabe : « وخبرتي » = « و » + « خبرتي » (conjonction collée au mot)
        if (!sc && LANG === 'ar' && t.length > 4 && t.charAt(0) === 'و') sc = tokenScore(t.slice(1), e);
        s += sc * w;
      });
      return { e: e, s: s, phrase: phrase };
    }).sort(function (a, b) { return b.s - a.s; });
    var best = scored[0], second = scored[1];
    if (!best || best.s < 3) return { status: 'none', top: scored.slice(0, 3) };
    if (best.phrase < 7 && isBlocked(q)) return { status: 'none', blocked: true };
    var alt = (second && second.s >= 3 && best.s - second.s < 1.5 && !second.e.raw.hidden) ? second.e.raw : null;
    return { status: 'ok', item: best.e.raw, score: best.s, alt: alt };
  }

  /* ------------------------------------------------------------------
     2. DONNÉES
     ------------------------------------------------------------------ */
  var DATA = null, loading = null;
  var BLOCK_RAW = {}, BLOCK_STEM = {}, BLOCK_PHR = [];
  function buildBlockers(list) {
    BLOCK_RAW = {}; BLOCK_STEM = {}; BLOCK_PHR = [];
    (list || []).forEach(function (b) {
      var n = norm(b); if (!n) return;
      if (n.indexOf(' ') > -1) BLOCK_PHR.push(n);
      else { BLOCK_RAW[n] = 1; if (LANG !== 'ar') BLOCK_STEM[stem(n)] = 1; }
    });
  }
  // Sujets volontairement non documentés (cotisation, événements, fondateurs…) : on renvoie vers le contact
  function isBlocked(q) {
    var padded = ' ' + q + ' ', i, toks = q.split(' ');
    for (i = 0; i < BLOCK_PHR.length; i++) if (padded.indexOf(' ' + BLOCK_PHR[i] + ' ') > -1) return true;
    for (i = 0; i < toks.length; i++) {
      if (BLOCK_RAW[toks[i]]) return true;
      if (LANG !== 'ar' && BLOCK_STEM[stem(toks[i])]) return true;
    }
    return false;
  }
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (loading) return loading;
    loading = fetch(FAQ_URL, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('faq ' + r.status); return r.json(); })
      .then(function (d) { DATA = d; buildIndex(d.items || []); buildBlockers(d.blockers); return d; })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  /* ------------------------------------------------------------------
     3. INTERFACE
     ------------------------------------------------------------------ */
  var ICON = {
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="jc-flip"><path d="M4 12l16-8-6 16-3-7-7-1z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="jc-flip"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) { return typeof u === 'string' && /^\/(?!\/)/.test(u) ? u : null; }

  var root, launcher, teaser, win, log, input, built = false, isOpen = false;
  var ui = {};

  function buildLauncher() {
    root = el('div', 'jc-root');
    root.setAttribute('lang', LANG);

    launcher = el('button', 'jc-launcher');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', LABEL_OPEN);
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'jc-window');
    var img = el('img'); img.src = IMG + 'mascot-avatar.webp'; img.alt = ''; img.width = 192; img.height = 192; img.decoding = 'async';
    launcher.appendChild(img);
    launcher.addEventListener('click', openChat);

    root.appendChild(launcher);
    document.body.appendChild(root);

    // Petite bulle d'invitation, une seule fois par session
    var seen = false; try { seen = sessionStorage.getItem('jc-teaser') === '1'; } catch (e) {}
    if (TEASER && !seen) {
      setTimeout(function () {
        if (isOpen) return;
        teaser = el('div', 'jc-teaser');
        teaser.setAttribute('role', 'status');
        var b = el('button', 'jc-teaser-text', TEASER); b.type = 'button';
        b.addEventListener('click', openChat);
        var x = el('button', 'jc-teaser-x'); x.type = 'button'; x.innerHTML = ICON.close;
        x.setAttribute('aria-label', 'Fermer');
        x.addEventListener('click', function () { hideTeaser(true); });
        teaser.appendChild(b); teaser.appendChild(x);
        root.appendChild(teaser);
        try { sessionStorage.setItem('jc-teaser', '1'); } catch (e) {}
      }, 7000);
    }
  }

  function hideTeaser() { if (teaser && teaser.parentNode) teaser.parentNode.removeChild(teaser); teaser = null; }

  function buildWindow() {
    built = true;
    win = el('div', 'jc-window'); win.id = 'jc-window';
    win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', ui.title || LABEL_OPEN);

    var lion = el('img', 'jc-lion'); lion.src = IMG + 'mascot-full.webp'; lion.alt = ''; lion.width = 364; lion.height = 760; lion.decoding = 'async';
    var bust = el('img', 'jc-bust'); bust.src = IMG + 'mascot-bust.webp'; bust.alt = ''; bust.width = 400; bust.height = 412; bust.decoding = 'async';

    var panel = el('div', 'jc-panel');

    var head = el('div', 'jc-head');
    var av = el('img', 'jc-head-avatar'); av.src = IMG + 'mascot-avatar.webp'; av.alt = ''; av.width = 44; av.height = 44;
    var ttl = el('div', 'jc-head-text');
    ttl.appendChild(el('p', 'jc-title', ui.title));
    var st = el('p', 'jc-status'); st.appendChild(el('span', 'jc-dot')); st.appendChild(document.createTextNode(ui.status || ''));
    ttl.appendChild(st);
    var bRestart = el('button', 'jc-iconbtn'); bRestart.type = 'button'; bRestart.innerHTML = ICON.refresh;
    bRestart.setAttribute('aria-label', ui.restart || 'Restart'); bRestart.title = ui.restart || '';
    bRestart.addEventListener('click', restart);
    var bClose = el('button', 'jc-iconbtn'); bClose.type = 'button'; bClose.innerHTML = ICON.close;
    bClose.setAttribute('aria-label', ui.close || 'Close'); bClose.title = ui.close || '';
    bClose.addEventListener('click', closeChat);
    head.appendChild(av); head.appendChild(ttl); head.appendChild(bRestart); head.appendChild(bClose);

    log = el('div', 'jc-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.tabIndex = 0;
    log.setAttribute('aria-label', ui.title || '');

    var form = el('form', 'jc-form'); form.setAttribute('autocomplete', 'off');
    input = el('input', 'jc-input'); input.type = 'text'; input.maxLength = 200;
    input.placeholder = ui.placeholder || ''; input.setAttribute('aria-label', ui.placeholder || 'Message');
    input.setAttribute('enterkeyhint', 'send');
    var send = el('button', 'jc-send'); send.type = 'submit'; send.innerHTML = ICON.send; send.setAttribute('aria-label', ui.send || 'Send');
    form.appendChild(input); form.appendChild(send);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim(); if (!v) return;
      input.value = '';
      ask(v);
    });

    var note = el('p', 'jc-note', ui.disclaimer);

    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(note);
    win.appendChild(lion); win.appendChild(bust); win.appendChild(panel);
    root.appendChild(win);
  }

  function scrollDown() {
    if (!log) return;
    var top = log.scrollHeight;
    if (REDUCE || !log.scrollTo) log.scrollTop = top; else log.scrollTo({ top: top, behavior: 'smooth' });
  }

  function botRow() {
    var row = el('div', 'jc-row jc-row--bot');
    var av = el('img', 'jc-msg-avatar'); av.src = IMG + 'mascot-avatar.webp'; av.alt = ''; av.width = 32; av.height = 32;
    var col = el('div', 'jc-col');
    row.appendChild(av); row.appendChild(col);
    return { row: row, col: col };
  }

  function addUser(text) {
    var row = el('div', 'jc-row jc-row--user');
    row.appendChild(el('div', 'jc-bubble jc-bubble--user', text));
    log.appendChild(row); scrollDown();
  }

  function fillBubble(bubble, text) {
    String(text).split('\n').forEach(function (line) {
      if (!line.trim()) return;
      bubble.appendChild(el('p', /^\d+\.\s/.test(line) ? 'jc-li' : '', line));
    });
  }

  function addChips(col, ids, title) {
    var items = ids.map(function (id) {
      for (var i = 0; i < DATA.items.length; i++) if (DATA.items[i].id === id) return DATA.items[i];
      return null;
    }).filter(function (x) { return x && !x.hidden; });
    if (!items.length) return;
    var wrap = el('div', 'jc-chips');
    if (title) wrap.appendChild(el('p', 'jc-chips-title', title));
    items.forEach(function (it) {
      var b = el('button', 'jc-chip', it.question); b.type = 'button';
      b.addEventListener('click', function () { addUser(it.question); respond(it, null); });
      wrap.appendChild(b);
    });
    col.appendChild(wrap);
  }

  function addLinks(col, links) {
    var ok = (links || []).map(function (l) { return { label: l.label, url: safeUrl(l.url) }; }).filter(function (l) { return l.url && l.label; });
    if (!ok.length) return;
    var wrap = el('div', 'jc-links');
    ok.forEach(function (l) {
      var a = el('a', 'jc-link'); a.href = l.url; a.appendChild(document.createTextNode(l.label));
      var s = el('span'); s.innerHTML = ICON.arrow; a.appendChild(s.firstChild);
      wrap.appendChild(a);
    });
    col.appendChild(wrap);
  }

  function typing() {
    var b = botRow();
    var bub = el('div', 'jc-bubble jc-bubble--bot jc-typing');
    bub.setAttribute('aria-label', ui.typing || '');
    bub.innerHTML = '<span></span><span></span><span></span>';
    b.col.appendChild(bub);
    log.appendChild(b.row); scrollDown();
    return b.row;
  }

  function reply(build, len) {
    var t = typing();
    var delay = REDUCE ? 0 : Math.min(420 + (len || 0) * 3, 1100);
    setTimeout(function () {
      var b = botRow();
      build(b.col);
      log.replaceChild(b.row, t);
      scrollDown();
    }, delay);
  }

  function respond(item, alt) {
    reply(function (col) {
      var bub = el('div', 'jc-bubble jc-bubble--bot'); fillBubble(bub, item.answer); col.appendChild(bub);
      addLinks(col, item.links);
      if (alt) {
        var wrap = el('div', 'jc-chips'); wrap.appendChild(el('p', 'jc-chips-title', ui.didYouMean));
        var b = el('button', 'jc-chip', alt.question); b.type = 'button';
        b.addEventListener('click', function () { addUser(alt.question); respond(alt, null); });
        wrap.appendChild(b); col.appendChild(wrap);
      } else if (!item.hidden || (item.related && item.related.length)) {
        addChips(col, item.related || [], ui.relatedTitle);
      }
    }, (item.answer || '').length);
  }

  function fallback() {
    reply(function (col) {
      var bub = el('div', 'jc-bubble jc-bubble--bot'); fillBubble(bub, ui.fallback); col.appendChild(bub);
      if (ui.fallbackLink) addLinks(col, [ui.fallbackLink]);
      addChips(col, featuredIds(), ui.suggestionsTitle);
    }, (ui.fallback || '').length);
  }

  function featuredIds() { return DATA.items.filter(function (i) { return i.featured; }).map(function (i) { return i.id; }); }

  function ask(text) {
    addUser(text);
    var m = match(text);
    if (m.status === 'ok') respond(m.item, m.alt);
    else if (m.status === 'short') reply(function (col) { var b = el('div', 'jc-bubble jc-bubble--bot'); fillBubble(b, ui.tooShort || ui.fallback); col.appendChild(b); }, 10);
    else fallback();
  }

  function greet() {
    log.innerHTML = '';
    var b = botRow();
    var bub = el('div', 'jc-bubble jc-bubble--bot'); fillBubble(bub, ui.welcome); b.col.appendChild(bub);
    addChips(b.col, featuredIds(), ui.suggestionsTitle);
    log.appendChild(b.row);
    log.scrollTop = 0;
  }

  function restart() { if (DATA) { greet(); input.focus(); } }

  function openChat() {
    if (isOpen) return;
    hideTeaser();
    load().then(function (d) {
      ui = d.ui || {};
      if (!built) { buildWindow(); greet(); }
      isOpen = true;
      root.classList.add('is-open');
      launcher.setAttribute('aria-expanded', 'true');
      setTimeout(function () { input.focus(); }, 60);
    }).catch(function () {
      // FAQ injoignable : on n'ouvre pas une fenêtre vide
      window.location.href = (LANG === 'en' ? '/en/contact/' : LANG === 'ar' ? '/ar/contact/' : '/contact/');
    });
  }

  function closeChat() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) closeChat(); });

  function init() { buildLauncher(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Exposé pour les tests et la mise au point de la FAQ (console : JisrChat.test("comment adhérer"))
  window.JisrChat = {
    load: load,
    match: function (q) { var m = match(q); return m.status === 'ok' ? { id: m.item.id, score: m.score, alt: m.alt && m.alt.id } : { id: null, status: m.status }; },
    test: function (q) { return load().then(function () { var m = match(q); console.log(m.status === 'ok' ? m.item.id + ' (' + m.score.toFixed(1) + ')' : 'aucune réponse'); return m; }); }
  };
})();
