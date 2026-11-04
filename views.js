(function () {
  const App = (window.JuzApp = window.JuzApp || {});
  const STAR = '14,0 18.1,4.1 23.9,4.1 23.9,9.9 28,14 23.9,18.1 23.9,23.9 18.1,23.9 14,28 9.9,23.9 4.1,23.9 4.1,18.1 0,14 4.1,9.9 4.1,4.1 9.9,4.1';
  const REPEATS = [1, 3, 5];
  const NO_STORE = {
    available: false,
    getNames: () => ['', '', '', ''],
    setName() {},
    getStar: () => false,
    setStar() {},
    getRepeat: () => 1,
    setRepeat() {},
    setLastSurah() {},
  };
  let ctx = {};

  App.setContext = (context) => {
    ctx = context;
  };

  function digits(n) {
    return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.setAttribute('class', className);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(className, text) {
    const node = el('button', className, text);
    node.setAttribute('type', 'button');
    return node;
  }

  function svg(markup) {
    const holder = document.createElement('template');
    holder.innerHTML = markup;
    return holder.content.firstElementChild;
  }

  function starIcon(number) {
    const label = number === undefined ? '' : `<text x="14" y="19" text-anchor="middle" font-size="13" fill="#FAC775" font-family="Amiri">${digits(number)}</text>`;
    return svg(`<svg class="chunk-star" viewBox="0 0 28 28" aria-hidden="true"><polygon points="${STAR}" fill="#0C447C" stroke="#BA7517" stroke-width="1.4"/>${label}</svg>`);
  }

  function emptyStar() {
    return svg(`<svg class="empty-star" viewBox="0 0 28 28" aria-hidden="true"><polygon points="${STAR}"/></svg>`);
  }

  function arch(text) {
    const node = svg(`<svg class="title" viewBox="0 0 400 86" role="img"><path d="M8 84 V46 C70 46 160 40 200 6 C240 40 330 46 392 46 V84 Z" fill="#0C447C" stroke="#BA7517" stroke-width="3"/><path d="M18 76 V53 C80 53 165 48 200 20 C235 48 320 53 382 53 V76 Z" fill="none" stroke="#FAC775" stroke-width="1"/><polygon points="${STAR}" fill="#FAC775" transform="translate(186 22)"/><text x="200" y="74" text-anchor="middle" font-family="Aref Ruqaa" font-size="27" fill="#FAC775"></text></svg>`);
    node.setAttribute('aria-label', text);
    node.querySelector('text').textContent = text;
    return node;
  }

  // Memorizing starts from the last surah of the juz, so it is station one.
  function stationOf(data, number) {
    return data.config.surahRange[1] + 1 - number;
  }

  function surahCount(data) {
    return data.config.surahRange[1] - data.config.surahRange[0] + 1;
  }

  function surahName(data, surah) {
    return data.booklet.surahNameFixes[String(surah.number)] || surah.name;
  }

  function screen(name) {
    const node = el('div', 'screen');
    node.setAttribute('data-screen', name);
    return node;
  }

  function sectionTitle(text) {
    return el('h2', 'section-title', text);
  }

  function renderMap(data) {
    const t = data.app.map;
    const node = screen('map');
    node.appendChild(arch(data.booklet.coverArch));
    node.appendChild(el('h1', 'app-title', data.booklet.title));
    if (data.booklet.presentedBy) node.appendChild(el('p', 'presented-by', data.booklet.presentedBy));
    node.appendChild(el('p', 'note', t.note));
    const grid = el('div', 'map-grid');
    data.quran.surahs.slice().reverse().forEach((surah) => {
      const station = document.createElement('a');
      station.setAttribute('class', 'station');
      station.setAttribute('data-s', String(surah.number));
      station.setAttribute('href', '#/surah/' + surah.number);
      station.appendChild(starIcon(stationOf(data, surah.number)));
      station.appendChild(el('span', 'station-name', surahName(data, surah)));
      const saved = el('span', 'station-saved', t.saved);
      saved.hidden = true;
      station.appendChild(saved);
      grid.appendChild(station);
      if (ctx.audioStore) {
        ctx.audioStore.hasSurah(surah.number, surah.ayat.length).then((has) => {
          saved.hidden = !has;
        }).catch(() => {});
      }
    });
    node.appendChild(grid);
    return node;
  }

  function makeChunk(data, surah, chunk, index) {
    const t = data.app.surah;
    const node = document.createElement('div');
    node.setAttribute('class', 'chunk');
    node.setAttribute('data-s', String(surah.number));
    node.setAttribute('data-from', String(chunk.from));
    node.setAttribute('data-to', String(chunk.to));
    node.setAttribute('data-tone', index % 2 === 0 ? 'a' : 'b');

    const head = el('div', 'chunk-head');
    head.appendChild(starIcon(index + 1));
    head.appendChild(button('play-chunk', t.playChunk));
    head.appendChild(button('cover-chunk', t.cover));
    node.appendChild(head);

    const text = el('div', 'chunk-text');
    surah.ayat.forEach((ayah) => {
      if (ayah.n < chunk.from || ayah.n > chunk.to) return;
      const span = document.createElement('span');
      span.setAttribute('class', 'ayah');
      span.setAttribute('data-s', String(surah.number));
      span.setAttribute('data-a', String(ayah.n));
      span.textContent = ayah.text;
      text.appendChild(span);
      text.appendChild(document.createTextNode(' '));
      text.appendChild(el('span', 'ayah-no', digits(ayah.n)));
      text.appendChild(document.createTextNode(' '));
    });
    node.appendChild(text);
    node.appendChild(el('div', 'keyword', chunk.keyword));
    return node;
  }

  function renderRepeat(data, store) {
    const group = el('div', 'repeat-group');
    group.appendChild(el('span', 'repeat-label', data.app.surah.repeat));
    REPEATS.forEach((n) => {
      const choice = button('repeat-btn', digits(n));
      choice.setAttribute('data-repeat', String(n));
      choice.setAttribute('aria-pressed', String(store.getRepeat() === n));
      group.appendChild(choice);
    });
    return group;
  }

  function renderSurah(data, number) {
    const store = ctx.store || NO_STORE;
    const t = data.app.surah;
    const surah = data.quran.surahs.find((s) => s.number === number);
    const node = screen('surah');
    const name = data.booklet.surahWord + ' ' + surahName(data, surah);
    node.appendChild(arch(name));
    const meta = el('div', 'surah-meta');
    meta.appendChild(el('span', '', data.booklet.stationLabel + ' ' + digits(stationOf(data, number)) + ' ' + data.booklet.ofWord + ' ' + digits(surahCount(data))));
    meta.appendChild(el('span', '', data.booklet.surahNumberLabel + ' ' + digits(number)));
    node.appendChild(meta);

    const controls = el('div', 'surah-controls');
    controls.appendChild(button('play-surah', t.playSurah));
    controls.appendChild(renderRepeat(data, store));
    node.appendChild(controls);
    node.appendChild(el('p', 'note', t.hint));

    const basmalah = document.createElement('div');
    basmalah.setAttribute('class', 'basmalah');
    basmalah.setAttribute('data-s', String(number));
    basmalah.textContent = data.quran.basmalah;
    node.appendChild(basmalah);

    data.chunks.surahs[String(number)].forEach((chunk, index) => {
      node.appendChild(makeChunk(data, surah, chunk, index));
    });

    const steps = el('div', 'steps');
    data.booklet.steps.forEach((step, index) => {
      if (index > 0) steps.appendChild(svg('<svg class="step-arrow" viewBox="0 0 16 8" aria-hidden="true"><path d="M16 4 H2 M6 1 L2 4 L6 7" fill="none" stroke="#BA7517" stroke-width="1.2"/></svg>'));
      steps.appendChild(el('span', '', step));
    });
    node.appendChild(steps);

    // Stays at the bottom of the screen, so a failure is seen where the recitation stopped.
    const bar = el('div', 'player-bar');
    bar.hidden = true;
    const message = el('p', 'message');
    message.setAttribute('role', 'status');
    message.hidden = true;
    bar.appendChild(message);
    const stop = button('stop-btn', t.stop);
    stop.hidden = true;
    bar.appendChild(stop);
    node.appendChild(bar);

    node.addEventListener('click', (event) => handleSurahClick(event, data, surah, store, node));
    return node;
  }

  function keysFor(surah, from, to) {
    return surah.ayat.filter((a) => a.n >= from && a.n <= to).map((a) => ({ s: surah.number, a: a.n }));
  }

  function handleSurahClick(event, data, surah, store, node) {
    const target = event.target;
    const chunk = target.closest('.chunk, .chunk.covered');
    if (target.closest('.ayah')) {
      const span = target.closest('.ayah');
      play([{ s: surah.number, a: Number(span.getAttribute('data-a')) }], store.getRepeat(), surah);
    } else if (target.closest('.play-chunk')) {
      play(keysFor(surah, Number(chunk.getAttribute('data-from')), Number(chunk.getAttribute('data-to'))), store.getRepeat(), surah);
    } else if (target.closest('.cover-chunk')) {
      const covered = chunk.classList.toggle('covered');
      target.textContent = covered ? data.app.surah.uncover : data.app.surah.cover;
    } else if (target.closest('.play-surah')) {
      play(keysFor(surah, 1, surah.ayat.length), 1, surah);
    } else if (target.closest('.repeat-btn')) {
      const value = Number(target.getAttribute('data-repeat'));
      store.setRepeat(value);
      node.querySelectorAll('.repeat-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === target)));
    } else if (target.closest('.stop-btn') && ctx.player) {
      ctx.player.stop();
    }
  }

  const savedThisSession = new Set();

  // Online, the first play in a surah saves the whole surah, so it can later be heard in full offline.
  function saveInBackground(surah) {
    if (!ctx.audioStore || savedThisSession.has(surah.number)) return;
    savedThisSession.add(surah.number);
    const items = surah.ayat.map((a) => ({ s: surah.number, a: a.n }));
    ctx.audioStore.download(items, () => {}).catch(() => {});
  }

  function play(keys, repeat, surah) {
    if (!ctx.player) return;
    clearFailure();
    if (ctx.audioStore && ctx.isOnline && !ctx.isOnline()) {
      // Offline, a recitation that would stop partway is not started at all.
      ctx.player.prime();
      ctx.audioStore.missing(keys).then((gaps) => {
        if (gaps.length > 0) App.showMessage(ctx.data.app.errors.network);
        else ctx.player.playSequence(keys, repeat);
      });
      return;
    }
    ctx.player.playSequence(keys, repeat);
    saveInBackground(surah);
  }

  function playerParts() {
    const root = ctx.root || document;
    return { root, bar: root.querySelector('.player-bar'), message: root.querySelector('.player-bar .message'), stop: root.querySelector('.stop-btn') };
  }

  function updateBar() {
    const { bar, message, stop } = playerParts();
    if (bar) bar.hidden = stop.hidden && message.hidden;
  }

  function clearFailure() {
    const { root } = playerParts();
    root.querySelectorAll('.ayah-failed').forEach((n) => n.classList.remove('ayah-failed'));
    App.showMessage('');
  }

  App.highlight = (key) => {
    const { root, stop } = playerParts();
    root.querySelectorAll('.ayah-active').forEach((n) => n.classList.remove('ayah-active'));
    if (stop) {
      stop.hidden = !key;
      updateBar();
    }
    if (!key) return;
    const span = root.querySelector(`.ayah[data-s="${key.s}"][data-a="${key.a}"]`);
    if (span) {
      span.classList.add('ayah-active');
      span.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  App.showMessage = (text) => {
    const { message } = playerParts();
    if (!message) return;
    message.textContent = text;
    message.hidden = !text;
    updateBar();
  };

  App.showFailure = (code, key) => {
    const { root } = playerParts();
    const errors = ctx.data.app.errors;
    const span = key && root.querySelector(`.ayah[data-s="${key.s}"][data-a="${key.a}"]`);
    if (span) span.classList.add('ayah-failed');
    const where = key ? ' ' + ctx.data.app.surah.ayahLabel + ' ' + digits(key.a) : '';
    App.showMessage((errors[code] || errors.play) + where);
  };

  App.connectPlayer = ({ audio, audioStore, unlockUrl, createUrl, revokeUrl }) => App.createPlayer({
    audio,
    unlockUrl,
    getBlob: audioStore.getBlob,
    createUrl: createUrl || ((blob) => URL.createObjectURL(blob)),
    revokeUrl: revokeUrl || ((url) => URL.revokeObjectURL(url)),
    onAyah: (key) => App.highlight(key),
    onError: (code, key) => App.showFailure(code, key),
  });

  function iosHint(data, node) {
    if (ctx.isIosBrowser && ctx.isIosBrowser()) node.appendChild(el('p', 'ios-hint', data.app.iosHint));
  }

  function renderRecord(data) {
    const store = ctx.store || NO_STORE;
    const t = data.app.record;
    const node = screen('record');
    node.appendChild(el('h1', 'app-title', t.title));
    node.appendChild(el('p', 'note', t.note));
    iosHint(data, node);
    if (!store.available) node.appendChild(el('p', 'message', t.storageOff));

    node.appendChild(sectionTitle(t.namesTitle));
    const names = el('div', 'record-names');
    store.getNames().forEach((name, i) => {
      const input = el('input', 'record-name');
      input.setAttribute('type', 'text');
      input.setAttribute('placeholder', t.namePlaceholder);
      input.setAttribute('aria-label', t.namePlaceholder);
      input.value = name;
      input.addEventListener('input', () => store.setName(i, input.value));
      names.appendChild(input);
    });
    node.appendChild(names);

    const rows = el('div', 'record-rows');
    data.quran.surahs.slice().reverse().forEach((surah) => {
      const row = el('div', 'record-row');
      row.appendChild(el('span', 'record-surah', surahName(data, surah)));
      const stars = el('span', 'record-stars');
      for (let i = 0; i < 4; i += 1) {
        const star = button('record-star');
        star.setAttribute('aria-label', surahName(data, surah) + ' ' + digits(i + 1));
        star.setAttribute('aria-pressed', String(store.getStar(surah.number, i)));
        star.appendChild(emptyStar());
        star.addEventListener('click', () => {
          const on = star.getAttribute('aria-pressed') !== 'true';
          star.setAttribute('aria-pressed', String(on));
          store.setStar(surah.number, i, on);
        });
        stars.appendChild(star);
      }
      row.appendChild(stars);
      rows.appendChild(row);
    });
    node.appendChild(rows);
    return node;
  }

  function renderGuide(data) {
    const t = data.app.guide;
    const node = screen('guide');
    node.appendChild(el('h1', 'app-title', t.title));
    t.items.forEach((item) => {
      node.appendChild(sectionTitle(item.heading));
      node.appendChild(el('p', 'body-text', item.text));
    });
    node.appendChild(sectionTitle(t.installTitle));
    t.install.forEach((line) => node.appendChild(el('p', 'body-text', line)));
    return node;
  }

  function renderDownload(data) {
    const t = data.app.about;
    const box = el('div', 'download');
    box.appendChild(sectionTitle(t.downloadTitle));
    box.appendChild(el('p', 'body-text', t.downloadNote));
    const start = button('download-btn', t.downloadButton);
    const status = el('p', 'message');
    status.setAttribute('role', 'status');
    status.hidden = true;
    box.appendChild(start);
    box.appendChild(status);
    start.addEventListener('click', async () => {
      if (!ctx.audioStore) return;
      const items = [];
      data.quran.surahs.forEach((s) => s.ayat.forEach((a) => items.push({ s: s.number, a: a.n })));
      start.disabled = true;
      status.hidden = false;
      const result = await ctx.audioStore.download(items, (done, total) => {
        status.textContent = t.downloadProgress + ' ' + digits(done) + ' / ' + digits(total);
      });
      if (result.storageError) status.textContent = data.app.errors.storage;
      else status.textContent = result.failed.length === 0 ? t.downloadDone : t.downloadFailed + ' ' + digits(result.failed.length);
      start.disabled = false;
    });
    return box;
  }

  function renderAbout(data) {
    const t = data.app.about;
    const node = screen('about');
    node.appendChild(el('h1', 'app-title', t.title));
    node.appendChild(el('p', 'sadaqa', data.app.sadaqa));
    if (data.booklet.presentedBy) node.appendChild(el('p', 'presented-by', data.booklet.presentedBy));
    node.appendChild(sectionTitle(data.booklet.dedicationTitle));
    data.booklet.dedication.forEach((line) => node.appendChild(el('p', 'dedication-text', line)));
    node.appendChild(el('p', 'body-text', t.privacy));
    iosHint(data, node);
    node.appendChild(renderDownload(data));
    node.appendChild(sectionTitle(t.noticesTitle));
    t.notices.forEach((n) => node.appendChild(el('p', 'body-text', n)));
    node.appendChild(sectionTitle(t.sourcesTitle));
    t.sources.forEach((s) => node.appendChild(el('p', 'body-text', s)));
    return node;
  }

  function renderNav(data, current) {
    const nav = el('nav', 'bottom-nav');
    [['map', '#/'], ['record', '#/record'], ['guide', '#/guide'], ['about', '#/about']].forEach(([key, href]) => {
      const link = el('a', 'nav-link', data.app.nav[key]);
      link.setAttribute('href', href);
      if (key === current) link.setAttribute('aria-current', 'page');
      nav.appendChild(link);
    });
    return nav;
  }

  // Leaving a screen always stops the recitation, so nothing keeps playing unseen.
  App.route = (hash) => {
    const data = ctx.data;
    if (ctx.player) ctx.player.stop();
    const surahMatch = /^#\/surah\/(\d+)$/.exec(hash || '');
    const number = surahMatch ? Number(surahMatch[1]) : 0;
    let view;
    let current = 'map';
    if (number >= data.config.surahRange[0] && number <= data.config.surahRange[1]) {
      view = renderSurah(data, number);
      current = '';
      if (ctx.store) ctx.store.setLastSurah(number);
    } else if (hash === '#/record') {
      view = renderRecord(data);
      current = 'record';
    } else if (hash === '#/guide') {
      view = renderGuide(data);
      current = 'guide';
    } else if (hash === '#/about') {
      view = renderAbout(data);
      current = 'about';
    } else {
      view = renderMap(data);
    }

    const root = ctx.root;
    root.textContent = '';
    if (data.config.reviewCopy) {
      const mark = el('div', 'review-mark', data.booklet.reviewMark);
      mark.setAttribute('data-review-mark', 'true');
      root.appendChild(mark);
    }
    const frame = el('div', 'frame');
    const inner = el('div', 'frame-inner');
    inner.appendChild(view);
    frame.appendChild(inner);
    root.appendChild(frame);
    root.appendChild(renderNav(data, current));
    window.scrollTo(0, 0);
    return view;
  };

  App.renderMap = renderMap;
  App.renderSurah = renderSurah;
  App.renderRecord = renderRecord;
  App.renderGuide = renderGuide;
  App.renderAbout = renderAbout;
})();
