const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { guessMicMode } = require('../.test-build/lib/micShare');

// Exercise the actual capture callback with browser capabilities and side effects mocked.
const source = fs.readFileSync('src/components/ExamRunner.tsx', 'utf8');
const callback = source.split('const beginAnswerCapture = useCallback((targetSlot: number) => {')[1]
  .split('}, [beginAudioCapture, startDictationFor, stopAnswerCapture, recordingAvailable]);')[0];
function capture(agent, speechSupported, recordingAvailable) {
  const events = [];
  let error = null;
  const context = {
    transcriptionJob: { current: null }, captureCompletion: { current: null },
    stopAnswerCapture: () => {}, setMicError: (value) => { error = value; }, setMicNotice: () => {},
    loadMicMode: () => guessMicMode(agent), micModeRef: { current: 'share' },
    isSpeechRecognitionSupported: () => speechSupported,
    startDictationFor: () => { events.push('dictation'); return true; },
    baseRef: { current: '' }, answersRef: { current: {} }, recordingAvailable,
    beginAudioCapture: () => events.push('recording'), setListening: () => {}, targetSlot: 1,
  };
  vm.runInNewContext('(function () {' + callback + '})()', context);
  return { events, error };
}
test('mobile starts Web Speech without opening a competing recorder', () => {
  for (const userAgent of ['Android Mobile', 'iPhone', 'iPad']) {
    assert.deepEqual(capture({ userAgent }, true, true).events, ['dictation']);
  }
  assert.deepEqual(capture({ userAgent: 'Macintosh', maxTouchPoints: 5 }, true, true).events, ['dictation']);
});
test('unsupported mobile speech reports an error without using AI recording', () => {
  const result = capture({ userAgent: 'Android Mobile' }, false, true);
  assert.deepEqual(result.events, []);
  assert.match(result.error, /음성 받아쓰기를 지원하지 않습니다/);
});
test('PC keeps parallel recording and its AI transcription fallback', () => {
  assert.deepEqual(capture({ userAgent: 'Windows NT' }, true, true).events, ['dictation', 'recording']);
  assert.deepEqual(capture({ userAgent: 'Windows NT' }, false, true).events, ['recording']);
});
