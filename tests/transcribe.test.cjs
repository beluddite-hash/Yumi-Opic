const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const source = fs.readFileSync('src/app/api/transcribe/route.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const route = new Module('transcription-test');
route._compile(compiled, 'transcription-test.cjs');
const { POST } = route.exports;
function request(audio) { const body = new FormData(); if (audio) body.append('audio', audio, 'answer.mp4'); return new Request('https://example.test/api/transcribe', { method: 'POST', body }); }
test('AI transcription accepts a recording without browser text and handles failures', async () => {
 const previousKey = process.env.OPENAI_API_KEY, previousFetch = global.fetch;
 try {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await POST(request())).status, 503);
  process.env.OPENAI_API_KEY = 'test-only';
  assert.equal((await POST(request())).status, 400);
  assert.equal((await POST(request(new Blob([''])))).status, 400);
  assert.equal((await POST(request(new Blob([new Uint8Array(4 * 1024 * 1024 + 1)])))).status, 413);
  global.fetch = async (url, options) => {
   assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
   assert.equal(options.body.get('language'), 'en');
   assert.equal(options.body.get('file').name, 'answer.mp4');
   assert(options.signal);
   return Response.json({text:' I love the park. '});
  };
  const audio = new Blob(['recorded-audio'], { type: 'audio/mp4' });
  assert.deepEqual(await (await POST(request(audio))).json(), {text:'I love the park.'});
  global.fetch = async () => Response.json({text:''});
  assert.equal((await POST(request(audio))).status, 422);
  global.fetch = async () => new Response('', { status: 429 });
  assert.equal((await POST(request(audio))).status, 502);
  global.fetch = async () => { throw new Error('network'); };
  assert.equal((await POST(request(audio))).status, 502);
 } finally { global.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
});
