(function () {
  const App = (window.JuzApp = window.JuzApp || {});
  const PREFIX = 'juz-amma:';
  const AUDIO_CACHE = 'juz-amma-audio-v1';
  const MEMBERS = 4;
  const REPEATS = [1, 3, 5];
  const PARALLEL_DOWNLOADS = 4;

  App.createStore = (localStorageLike) => {
    let available = true;
    try {
      localStorageLike.setItem(PREFIX + 'probe', '1');
      localStorageLike.removeItem(PREFIX + 'probe');
    } catch (error) {
      available = false;
    }
    // Choices made in this session always hold, even when the device refuses to keep them.
    const session = new Map();

    function read(key) {
      if (session.has(key)) return session.get(key);
      if (!available) return null;
      try {
        return localStorageLike.getItem(PREFIX + key);
      } catch (error) {
        return null;
      }
    }

    function write(key, value) {
      session.set(key, value);
      if (!available) return;
      try {
        localStorageLike.setItem(PREFIX + key, value);
      } catch (error) {
        // A full disk must not interrupt reciting; the record screen already warns about saving.
      }
    }

    function getNames() {
      try {
        const names = JSON.parse(read('names'));
        if (Array.isArray(names) && names.length === MEMBERS) return names;
      } catch (error) {
        // Damaged values fall through to the default.
      }
      return ['', '', '', ''];
    }

    return {
      available,
      getNames,
      setName(index, name) {
        const names = getNames();
        names[index] = name;
        write('names', JSON.stringify(names));
      },
      getStar: (surah, member) => read(`star:${surah}:${member}`) === '1',
      setStar: (surah, member, on) => write(`star:${surah}:${member}`, on ? '1' : '0'),
      getRepeat() {
        const value = Number(read('repeat'));
        return REPEATS.includes(value) ? value : 1;
      },
      setRepeat: (value) => write('repeat', String(value)),
      getLastSurah: () => Number(read('last-surah')) || 0,
      setLastSurah: (value) => write('last-surah', String(value)),
    };
  };

  function coded(code, cause) {
    const error = new Error(code);
    error.code = code;
    error.cause = cause;
    return error;
  }

  function isQuotaError(error) {
    return Boolean(error) && (error.name === 'QuotaExceededError' || error.code === 22);
  }

  App.createAudioStore = ({ cachesLike, fetchLike, audioBase }) => {
    function urlFor(s, a) {
      return audioBase + String(s).padStart(3, '0') + String(a).padStart(3, '0') + '.mp3';
    }

    async function openCache() {
      try {
        return await cachesLike.open(AUDIO_CACHE);
      } catch (error) {
        return null;
      }
    }

    // The whole body is read here, so a connection lost halfway counts as a network failure.
    async function fetchAudio(url) {
      let response;
      try {
        response = await fetchLike(url);
      } catch (error) {
        throw coded('network', error);
      }
      if (!response.ok) throw coded('network');
      try {
        return { blob: await response.blob(), headers: response.headers };
      } catch (error) {
        throw coded('network', error);
      }
    }

    function toResponse(fetched) {
      return new Response(fetched.blob, { headers: fetched.headers });
    }

    async function isSaved(cache, url) {
      if (!cache) return false;
      try {
        return Boolean(await cache.match(url));
      } catch (error) {
        return false;
      }
    }

    return {
      urlFor,

      async getBlob(s, a) {
        const url = urlFor(s, a);
        const cache = await openCache();
        if (cache) {
          try {
            const saved = await cache.match(url);
            if (saved) return await saved.blob();
          } catch (error) {
            // Reading failed, so the network is the only way left.
          }
        }
        const fetched = await fetchAudio(url);
        if (cache) {
          try {
            await cache.put(url, toResponse(fetched));
          } catch (error) {
            // Without room to save, the ayah still plays.
          }
        }
        return fetched.blob;
      },

      // Recitation saved from another reciter is never played again, so its space is given back.
      async prune() {
        const cache = await openCache();
        if (!cache || !cache.keys) return 0;
        let removed = 0;
        try {
          for (const request of await cache.keys()) {
            const url = typeof request === 'string' ? request : request.url;
            if (!url.startsWith(audioBase)) {
              await cache.delete(request);
              removed += 1;
            }
          }
        } catch (error) {
          // Leaving old files in place is harmless.
        }
        return removed;
      },

      async missing(items) {
        const cache = await openCache();
        const gaps = [];
        for (const item of items) {
          if (!(await isSaved(cache, urlFor(item.s, item.a)))) gaps.push(item);
        }
        return gaps;
      },

      async hasSurah(s, count) {
        const cache = await openCache();
        if (!cache) return false;
        for (let a = 1; a <= count; a += 1) {
          if (!(await isSaved(cache, urlFor(s, a)))) return false;
        }
        return true;
      },

      async download(items, onProgress) {
        const cache = await openCache();
        if (!cache) return { done: 0, failed: items.slice(), storageError: true };
        const failed = [];
        let storageError = false;
        let done = 0;
        let finished = 0;
        let next = 0;

        async function worker() {
          while (next < items.length && !storageError) {
            const item = items[next];
            next += 1;
            const url = urlFor(item.s, item.a);
            try {
              if (!(await isSaved(cache, url))) {
                const fetched = await fetchAudio(url);
                try {
                  await cache.put(url, toResponse(fetched));
                } catch (error) {
                  if (isQuotaError(error)) storageError = true;
                  throw error;
                }
              }
              done += 1;
            } catch (error) {
              failed.push(item);
            }
            finished += 1;
            onProgress(finished, items.length);
          }
        }

        const workers = [];
        for (let i = 0; i < PARALLEL_DOWNLOADS; i += 1) workers.push(worker());
        await Promise.all(workers);
        // A full disk stops the rest, which still count as not saved.
        while (next < items.length) {
          failed.push(items[next]);
          next += 1;
        }
        return { done, failed, storageError };
      },
    };
  };
})();
