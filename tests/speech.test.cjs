const test = require('node:test');
const assert = require('node:assert/strict');
const { startDictation } = require('../.test-build/lib/speech');

const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S926N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

const FINAL = (transcript) => ({ isFinal: true, transcript });
const PENDING = (transcript) => ({ isFinal: false, transcript });

/**
 * 브라우저 인식기를 흉내 낸 창에서 받아쓰기를 돌린다. 인식기가 언제 무엇을 보낼지는
 * 테스트가 정한다. 다시 켜기를 기다리는 타이머는 `flush` 로 흘려보낸다.
 *
 * `options.startFails` 는 앞 세션이 아직 닫히지 않아 `start()` 가 거절되는 기기를,
 * `options.document` 는 화면이 꺼지고 돌아오는 것을 흉내 낸다.
 */
function withDictation(navigator, run, options = {}) {
  const recognizers = [];
  const timers = new Map();
  let nextTimer = 0;

  class FakeRecognition {
    constructor() {
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.onaudiostart = null;
      this.onspeechstart = null;
      this.onspeechend = null;
      this.stopped = false;
      recognizers.push(this);
    }
    start() { if (options.startFails?.(recognizers.length)) throw new Error('InvalidStateError'); }
    stop() { this.stopped = true; }
    abort() {}
    /** 이 세션의 results 전체를 한 번 보낸다. */
    send(results) {
      const list = results.map(({ isFinal, transcript }) => Object.assign([{ transcript }], { isFinal }));
      this.onresult?.({ resultIndex: 0, results: list });
    }
    /** 마이크가 실제로 열렸다. 말을 안 해도 브라우저가 보내는 신호다. */
    audioStart() { this.onaudiostart?.(); }
    speechStart() { this.onspeechstart?.(); }
    fail(error) { this.onerror?.({ error }); }
    end() { this.onend?.(); }
  }

  const listeners = new Set();
  const page = options.document
    ? {
      visibilityState: 'visible',
      addEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.add(fn); },
      removeEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.delete(fn); },
    }
    : null;

  const previousWindow = global.window;
  const previousDocument = global.document;
  global.window = {
    navigator,
    webkitSpeechRecognition: FakeRecognition,
    setTimeout: (fn, ms) => { timers.set(++nextTimer, { fn, ms }); return nextTimer; },
    clearTimeout: (id) => { timers.delete(id); },
  };
  if (page) global.document = page;

  const flush = () => {
    for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); }
  };
  /** 지금 걸려 있는 타이머의 기다리는 시간(ms)들. */
  const delays = () => [...timers.values()].map((timer) => timer.ms);
  /** 화면을 끄거나 켠다. 브라우저가 보내는 visibilitychange 도 함께 흘린다. */
  const setVisibility = (state) => {
    page.visibilityState = state;
    for (const fn of [...listeners]) fn();
  };
  const current = () => recognizers[recognizers.length - 1];
  try {
    run({ recognizers, current, flush, delays, setVisibility, listeners });
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
}

function listen() {
  const state = { draft: { committed: '', interim: '' }, ended: false, errors: [], activity: [] };
  const handle = startDictation({
    onUpdate: (draft) => { state.draft = draft; },
    onActivity: (value) => { state.activity.push(value); },
    onError: (code) => { state.errors.push(code); },
    onEnd: () => { state.ended = true; },
  });
  return { handle, state };
}

test('휴대폰은 continuous 를 끄고 발화마다 다시 켜서 말한 내용을 한 번씩 받는다', () => {
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ recognizers, current, flush }) => {
    const { handle, state } = listen();
    assert.equal(current().continuous, false);
    assert.equal(current().interimResults, true);

    // 가설은 interim 한 칸을 고쳐 쓰고, 발화가 끝나면 final 이 한 번 온다
    current().send([PENDING('I')]);
    current().send([PENDING('I like')]);
    assert.deepEqual(state.draft, { committed: '', interim: 'I like' });
    current().send([FINAL('I like running')]);
    assert.deepEqual(state.draft, { committed: 'I like running', interim: '' });

    // 안드로이드는 결과를 내면 세션을 닫는다. 새 인식기로 이어 받는다
    current().end();
    flush();
    assert.equal(recognizers.length, 2);
    assert.equal(current().continuous, false);
    current().send([PENDING('every morning')]);
    assert.deepEqual(state.draft, { committed: 'I like running', interim: 'every morning' });

    // 멈추면 말하던 문장까지 받아 적고 끝낸다
    handle.stop();
    assert.equal(current().stopped, true);
    current().send([FINAL('every morning')]);
    current().end();
    flush();
    assert.deepEqual(state.draft, { committed: 'I like running every morning', interim: '' });
    assert.equal(state.ended, true);
    assert.equal(recognizers.length, 2);
  });
});

test('데스크톱은 지금처럼 continuous 한 세션에서 이어서 받는다', () => {
  withDictation({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 }, ({ recognizers, current }) => {
    const { handle, state } = listen();
    assert.equal(current().continuous, true);

    current().send([FINAL('I like running')]);
    current().send([FINAL('I like running'), PENDING(' every')]);
    assert.deepEqual(state.draft, { committed: 'I like running', interim: 'every' });
    current().send([FINAL('I like running'), FINAL(' every morning')]);
    current().send([FINAL('I like running'), FINAL(' every morning')]);
    assert.deepEqual(state.draft, { committed: 'I like running every morning', interim: '' });

    handle.stop();
    current().end();
    assert.equal(state.draft.committed, 'I like running every morning');
    assert.equal(state.ended, true);
    assert.equal(recognizers.length, 1);
  });
});

test('받아쓰기는 한 번에 하나만 돈다', () => {
  withDictation({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 }, ({ recognizers, current, flush }) => {
    const first = listen();
    current().send([FINAL('I like running')]);

    /*
     * 브라우저의 인식기는 사실상 하나다. 둘째를 켤 때 앞의 것을 끊지 않으면, 앞의
     * 것이 `aborted` 로 끊긴 뒤 스스로 다시 켜져 둘째를 끊고 둘이 서로를 걷어찬다.
     */
    const second = listen();
    assert.equal(first.state.ended, true);
    // 끊기기 전까지 받아 적은 말은 남는다.
    assert.equal(first.state.draft.committed, 'I like running');

    // 앞의 것은 다시 켜지지 않는다. 지금 도는 인식기는 둘째 것뿐이다.
    const running = recognizers.length;
    flush();
    assert.equal(recognizers.length, running);

    current().send([FINAL('and swimming')]);
    assert.equal(second.state.draft.committed, 'and swimming');
    assert.equal(second.state.ended, false);

    second.handle.stop();
    current().end();
    assert.equal(second.state.ended, true);
  });
});

test('휴대폰은 발화마다 다시 켜므로 데스크톱보다 짧게 쉰다', () => {
  let mobileDelay = null;
  let desktopDelay = null;

  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ current, delays }) => {
    listen();
    current().send([FINAL('I like running')]);
    current().end();
    [mobileDelay] = delays();
  });

  withDictation({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 }, ({ current, delays }) => {
    listen();
    current().send([FINAL('I like running')]);
    current().end();
    [desktopDelay] = delays();
  });

  // 이 사이는 말이 그대로 사라지는 구멍이다. 발화마다 겪는 휴대폰이 더 짧아야 한다.
  assert.ok(mobileDelay < desktopDelay, `${mobileDelay} < ${desktopDelay}`);
});

test('마이크가 열리고 말소리가 들어오는 것을 그대로 알린다', () => {
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ current, flush }) => {
    const { state } = listen();
    assert.deepEqual(state.activity, ['starting']);

    current().audioStart();
    current().speechStart();
    assert.deepEqual(state.activity, ['starting', 'listening', 'speaking']);

    // 마이크가 열린 뒤에는 「마이크를 못 열었다」고 알리지 않는다
    flush();
    assert.deepEqual(state.errors, []);
  });
});

test('마이크가 끝내 열리지 않으면 조용히 두지 않고 알린다', () => {
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ flush }) => {
    const { state } = listen();
    // 인식기는 켜졌다고 하는데 audiostart 가 오지 않는다. 조용히 있는 것과 다르다.
    flush();
    assert.deepEqual(state.errors, ['mic-silent']);
    // 같은 말을 되풀이하지 않는다
    flush();
    assert.deepEqual(state.errors, ['mic-silent']);
  });
});

test('켜자마자 빈손으로 끝나는 세션이 이어지면 멈추고 알린다', () => {
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ recognizers, current, flush }) => {
    const { state } = listen();
    // 아이폰 사파리는 버튼을 누른 직후가 아니면 켜진 척만 하고 곧바로 닫는다.
    for (let i = 0; i < 4; i++) {
      current().end();
      flush();
    }
    assert.deepEqual(state.errors, ['mic-silent']);
    assert.equal(state.ended, true);
    // 다시 켜기를 되풀이하지 않고 멈춘다
    const running = recognizers.length;
    flush();
    assert.equal(recognizers.length, running);
  });
});

test('받아 적고 있으면 세션이 끊겨도 계속 다시 켠다', () => {
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ recognizers, current, flush }) => {
    const { state } = listen();
    for (let i = 0; i < 6; i++) {
      current().send([FINAL('one more thing')]);
      current().end();
      flush();
    }
    assert.deepEqual(state.errors, []);
    assert.equal(state.ended, false);
    assert.equal(recognizers.length, 7);
  });
});

test('화면이 꺼진 동안에는 다시 켜지 않고, 돌아오면 스스로 다시 켠다', () => {
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ recognizers, current, flush, setVisibility, listeners }) => {
    const { handle, state } = listen();
    current().send([FINAL('I go jogging')]);

    // 다른 앱으로 넘어가면 인식기가 닫히고, 그동안은 켜지지 않는다
    setVisibility('hidden');
    current().end();
    flush();
    assert.equal(recognizers.length, 1);
    assert.equal(state.activity.at(-1), 'paused');
    assert.equal(state.ended, false);

    // 돌아오면 기다리지 않고 곧바로 이어 받는다
    setVisibility('visible');
    assert.equal(recognizers.length, 2);
    current().send([FINAL('every morning')]);
    assert.equal(state.draft.committed, 'I go jogging every morning');

    // 끝낼 때 화면 감시도 함께 거둔다
    handle.abort();
    assert.equal(listeners.size, 0);
  }, { document: true });
});

test('다시 켜기가 거절되면 조금 더 기다렸다 다시 해 본다', () => {
  // 두 번째 인식기만 거절한다. 앞 세션이 아직 닫히는 중일 때 나는 일이다.
  withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ recognizers, current, flush }) => {
    const { state } = listen();
    current().send([FINAL('I go jogging')]);
    current().end();
    flush(); // 두 번째 시작이 거절된다

    assert.equal(state.ended, false);
    assert.deepEqual(state.errors, []);
    flush(); // 세 번째는 켜진다
    assert.equal(recognizers.length, 3);
    current().send([FINAL('every morning')]);
    assert.equal(state.draft.committed, 'I go jogging every morning');
  }, { startFails: (count) => count === 2 });
});


test('모바일 무음 종료는 600/1200/2400ms로 늦추고 네 번째에 멈추며 답변은 남긴다', () => {
  const previousNow = Date.now;
  let now = 0;
  Date.now = () => now;
  try {
    withDictation({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 }, ({ recognizers, current, flush, delays }) => {
      const { state } = listen();
      current().send([FINAL('My saved answer')]); current().end(); flush();
      for (const delay of [600, 1200, 2400]) {
        current().audioStart(); now += 5000;
        current().fail('no-speech'); current().end();
        assert.deepEqual(delays(), [delay]); flush();
      }
      current().audioStart(); now += 5000; current().fail('no-speech'); current().end();
      assert.equal(state.ended, true);
      assert.equal(state.draft.committed, 'My saved answer');
      assert.deepEqual(state.errors, ['mic-silent']);
      const count = recognizers.length; flush(); assert.equal(recognizers.length, count);
    });
  } finally { Date.now = previousNow; }
});

test('모바일 정상 발화가 돌아오면 재시작 지연을 초기화하고 중복 없이 잇는다', () => {
  withDictation({ userAgent: ANDROID_CHROME }, ({ current, flush, delays }) => {
    const { handle, state } = listen();
    current().audioStart(); current().fail('no-speech'); current().end();
    assert.deepEqual(delays(), [600]); flush();
    current().send([PENDING('I like'), PENDING('')]);
    current().send([FINAL('I like running')]); current().send([FINAL('I like running')]);
    current().end(); assert.deepEqual(delays(), [120]); flush();
    current().send([FINAL('every morning')]); handle.stop(); current().end(); flush();
    assert.equal(state.draft.committed, 'I like running every morning');
    assert.equal(state.ended, true);
  });
});

test('모바일 재시작 대기 중 stop 하면 더 켜지지 않고 이전 텍스트를 보존한다', () => {
  withDictation({ userAgent: ANDROID_CHROME }, ({ current, recognizers, flush }) => {
    const { handle, state } = listen();
    current().send([FINAL('Keep this answer')]); current().end(); flush();
    current().audioStart(); current().fail('no-speech'); current().end();
    const count = recognizers.length; handle.stop(); flush();
    assert.equal(recognizers.length, count); assert.equal(state.draft.committed, 'Keep this answer');
    assert.equal(state.ended, true);
  });
});

test('PC 무음 종료는 기존 300ms 재시작을 유지한다', () => {
  withDictation({ userAgent: DESKTOP_CHROME }, ({ current, delays }) => {
    const { handle } = listen(); current().audioStart(); current().fail('no-speech'); current().end();
    assert.deepEqual(delays(), [300]); handle.abort();
  });
});
