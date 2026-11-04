(async function () {
  const App = window.JuzApp;
  const root = document.documentElement;
  const data = await (await fetch('data.json')).json();

  async function fontsLoaded() {
    let ok = true;
    for (const font of data.config.fonts) {
      try {
        const faces = await document.fonts.load('20px "' + font.family + '"', 'ب');
        if (faces.length === 0) ok = false;
      } catch (error) {
        ok = false;
      }
    }
    document.fonts.forEach((face) => {
      if (face.status === 'error') ok = false;
    });
    return ok;
  }

  // A few silent samples: a short 8-bit mono WAV.
  function silentWavUrl() {
    const samples = 160;
    const bytes = new Uint8Array(44 + samples).fill(128);
    const view = new DataView(bytes.buffer);
    const text = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    text(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 8000, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    text(36, 'data');
    view.setUint32(40, samples, true);
    return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  }

  let localStorageLike = null;
  try {
    localStorageLike = window.localStorage;
  } catch (error) {
    // The store treats a missing or blocked storage as unavailable.
  }
  const store = App.createStore(localStorageLike || {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  });

  const cachesLike = window.caches || { open: () => Promise.reject(new Error('unavailable')) };
  const audioStore = App.createAudioStore({
    cachesLike,
    // The recitation is kept in the app's own store, so the browser need not keep a second copy.
    fetchLike: (url) => fetch(url, { cache: 'no-store', referrerPolicy: 'no-referrer' }),
    audioBase: data.config.audioBase,
  });

  const player = App.connectPlayer({ audio: new Audio(), audioStore, unlockUrl: silentWavUrl() });
  const isIosBrowser = () => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !navigator.standalone;
  };

  App.setContext({
    data,
    root: document.getElementById('app'),
    store,
    audioStore,
    player,
    isOnline: () => navigator.onLine,
    isIosBrowser,
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  audioStore.prune().catch(() => {});

  const fontsOk = await fontsLoaded();
  App.route(location.hash);
  window.addEventListener('hashchange', () => App.route(location.hash));
  root.setAttribute('data-fonts-ok', String(fontsOk));
  root.setAttribute('data-ready', 'true');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.ready.then(() => {
      const mark = () => root.setAttribute('data-sw-ready', 'true');
      if (navigator.serviceWorker.controller) mark();
      else navigator.serviceWorker.addEventListener('controllerchange', mark);
    });
  }
})();
