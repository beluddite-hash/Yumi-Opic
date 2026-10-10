const test = require('node:test');
const assert = require('node:assert/strict');
const { createMicDiagnostic, diagnosticSessionText, diagnosticPreviewAllowed } = require('../.test-build/lib/mobileMicDiagnostic');

function setup(mode, androidChromium = true) {
  let state, now = 0, next = 0, visible = true;
  const recognizers = [], timers = new Map();
  const harness = createMicDiagnostic({ mode, androidChromium,
    create: () => {
      const r = { start() { this.startCalls = (this.startCalls ?? 0) + 1; this.onstart?.(); }, stop() { this.stopCalls = (this.stopCalls ?? 0) + 1; }, abort() { this.abortCalls = (this.abortCalls ?? 0) + 1; },
        send(texts) { this.onresult?.({ results: texts.map((t) => Object.assign([{ transcript: t }], { isFinal: true })) }); } };
      recognizers.push(r); return r;
    }, now: () => now, visible: () => visible,
    schedule: (fn, ms) => { timers.set(++next, { fn, ms }); return next; }, cancel: (id) => timers.delete(id),
    update: (s) => { state = s; },
  });
  return { harness, recognizers, timers, state: () => state, current: () => recognizers.at(-1),
    hide: () => { visible = false; harness.hide(); }, show: () => { visible = true; },
    flush: () => { for (const [id,t] of [...timers]) { timers.delete(id); now += t.ms; t.fn(); } },
  };
}
test('diagnostic route is available only in development or the named Preview branch', () => {
  assert.equal(diagnosticPreviewAllowed('preview', 'test/mobile-mic-sound-ab-20261011', false), true);
  assert.equal(diagnosticPreviewAllowed('production', 'test/mobile-mic-sound-ab-20261011', false), false);
  assert.equal(diagnosticPreviewAllowed('preview', 'main', false), false);
  assert.equal(diagnosticPreviewAllowed(undefined, undefined, false), false);
  assert.equal(diagnosticPreviewAllowed(undefined, undefined, true), true);
});
test('A and B have the same restart timing and differ in continuous', () => {
  for (const mode of ['single-auto','continuous-auto']) {
    const s = setup(mode); s.harness.start();
    assert.equal(s.current().continuous, mode === 'continuous-auto');
    s.current().send(['hello']); s.current().onend();
    assert.equal([...s.timers.values()][0].ms, 120); s.flush();
    assert.equal(s.recognizers.length, 2); s.harness.dispose();
  }
});
test('C never automatically restarts; manual continuation keeps previous words', () => {
  const s = setup('continuous-manual'); s.harness.start(); s.current().send(['first sentence']); s.current().onend(); s.flush();
  assert.equal(s.recognizers.length, 1); assert.equal(s.state().running, false);
  s.harness.start(); s.current().send(['second sentence']);
  assert.equal(s.state().text, 'first sentence second sentence'); s.harness.dispose();
});
test('speechend does not call stop or start in any mode', () => {
  for (const mode of ['single-auto','continuous-auto','continuous-manual']) {
    const s = setup(mode); s.harness.start(); s.current().onspeechend(); s.flush();
    assert.equal(s.recognizers.length, 1); assert.equal(s.current().stopCalls, undefined); s.harness.dispose();
  }
});
test('Android cumulative hypotheses and corrected prefixes replace rather than duplicate', () => {
  const s = setup('continuous-manual'); s.harness.start();
  s.current().send(['I','I goat']); s.current().send(['I','I goat','I go to the gym']);
  s.current().send(['I','I goat','I go to the gym']);
  assert.equal(s.state().text, 'I go to the gym'); s.harness.stop();
  s.current().send(['I','I goat','I go to the gym every morning']); s.current().onend();
  assert.equal(s.state().text, 'I go to the gym every morning');
});
test('actual repeated words and same sentence in separate sessions survive', () => {
  const s = setup('continuous-manual'); s.harness.start(); s.current().send(['very','very very good']); s.current().onend();
  s.harness.start(); s.current().send(['very very good']); s.current().onend();
  assert.equal(s.state().text, 'very very good very very good');
  assert.equal(diagnosticSessionText([{transcript:'first',isFinal:true},{transcript:'second',isFinal:true}], false), 'first second');
});
test('stop cancels pending restart and dispose ignores late callbacks', () => {
  const s = setup('continuous-auto'); s.harness.start(); s.current().send(['keep me']); s.current().onend();
  s.harness.stop(); s.flush(); assert.equal(s.recognizers.length, 1);
  s.harness.start(); const r = s.current(); s.harness.dispose(); r.send(['late']); r.onend(); s.flush();
  assert.equal(s.state().text, 'keep me'); assert.equal(s.recognizers.length, 2);
});
test('hidden page aborts and return to foreground never triggers automatic start', () => {
  const s = setup('continuous-auto'); s.harness.start(); s.current().send(['keep me']); s.hide(); s.current().onend(); s.show(); s.flush();
  assert.equal(s.recognizers.length, 1); assert.equal(s.current().abortCalls, 1);
  assert.equal(s.state().text, 'keep me'); s.harness.dispose();
});
test('permission error never auto restarts; empty auto sessions are bounded', () => {
  const denied = setup('continuous-auto'); denied.harness.start(); denied.current().onerror({error:'not-allowed'}); denied.current().onend(); denied.flush();
  assert.equal(denied.recognizers.length, 1); assert.equal(denied.state().errors, 1);
  const s = setup('single-auto'); s.harness.start();
  for (let i=0;i<4;i++) { s.current().onend(); s.flush(); }
  assert.equal(s.recognizers.length, 4); assert.equal(s.state().waiting, false);
});
test('marking a heard sound logs it without opening the microphone', () => {
  const s = setup('continuous-manual'); s.harness.start(); s.harness.markSound();
  assert.equal(s.state().sounds, 1); assert.equal(s.recognizers.length, 1);
  assert.equal(s.state().events.at(-1).type, 'sound-heard'); s.harness.dispose();
});
