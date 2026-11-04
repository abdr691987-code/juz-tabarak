(function () {
  const App = (window.JuzApp = window.JuzApp || {});

  App.createPlayer = ({ audio, unlockUrl, getBlob, createUrl, revokeUrl, onAyah, onError }) => {
    // Each call takes a new session number, so a slow download from an older tap can never start playing.
    let session = 0;
    let playing = false;
    let settle = null;

    function interrupt() {
      session += 1;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      if (settle) settle();
      settle = null;
    }

    function playOne(blob) {
      const url = createUrl(blob);
      return new Promise((resolve, reject) => {
        settle = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('play'));
        audio.src = url;
        Promise.resolve(audio.play()).catch(reject);
      }).finally(() => {
        settle = null;
        revokeUrl(url);
      });
    }

    function finish() {
      playing = false;
      onAyah(null);
    }

    // Phones allow sound only from inside a tap. Starting this element now keeps it allowed after a wait.
    function prime() {
      if (!unlockUrl) return;
      audio.src = unlockUrl;
      Promise.resolve(audio.play()).catch(() => {});
    }

    async function playSequence(keys, repeat) {
      interrupt();
      const id = session;
      playing = true;
      prime();
      let key = keys[0];
      try {
        for (let round = 0; round < repeat; round += 1) {
          for (key of keys) {
            onAyah(key);
            const blob = await getBlob(key.s, key.a);
            if (id !== session) return;
            await playOne(blob);
            if (id !== session) return;
          }
        }
        finish();
      } catch (error) {
        if (id !== session) return;
        finish();
        onError(error.code || 'play', key);
      }
    }

    return {
      playSequence,
      prime,
      stop() {
        interrupt();
        if (playing) finish();
      },
      isPlaying: () => playing,
    };
  };
})();
