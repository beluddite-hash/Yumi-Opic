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
 */
function withDictation(navigator, run) {
  const recognizers = [];
  const timers = new Map();
  let nextTimer = 0;

  class FakeRecognition {
    constructor() {
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.stopped = false;
      recognizers.push(this);
    }
    start() {}
    stop() { this.stopped = true; }
    abort() {}
    /** 이 세션의 results 전체를 한 번 보낸다. */
    send(results) {
      const list = results.map(({ isFinal, transcript }) => Object.assign([{ transcript }], { isFinal }));
      this.onresult?.({ resultIndex: 0, results: list });
    }
    end() { this.onend?.(); }
  }

  const previous = global.window;
  global.window = {
    navigator,
    webkitSpeechRecognition: FakeRecognition,
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => { timers.delete(id); },
  };
  const flush = () => {
    for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
  };
  const current = () => recognizers[recognizers.length - 1];
  try {
    run({ recognizers, current, flush });
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
}

function listen() {
  const state = { draft: { committed: '', interim: '' }, ended: false };
  const handle = startDictation({
    onUpdate: (draft) => { state.draft = draft; },
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
