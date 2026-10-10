# Galaxy Web Speech diagnostic preview

This page is independent of the exam: `/diagnostics/mobile-mic`. It is available only in development or a Vercel Preview for `test/mobile-mic-sound-ab-20261011`. Production requests return 404. There is no navigation link from the existing site.

## Cost and scope

PC recording and AI transcription remain unchanged. Mobile diagnostics use only browser Web Speech: no site transcription API, paid realtime AI, recorder, exam answer persistence, grading, or question audio calls. Browser recognition may itself use the browser provider's server; this is not a promise of offline recognition. Existing grading costs are unchanged.

## What the comparison measures

- A: `continuous=false`, restart 120 ms after a real `end`.
- B: `continuous=true`, the same 120 ms restart after a real `end`.
- C: `continuous=true`, no automatic restart. After a real `end`, the user must resume manually.

All modes only log `speechend`; none stops or restarts on that event. Stop, hidden tabs and disposal cancel scheduled restarts. Permission errors stop automatic recovery; four consecutive empty sessions also stop it. No site sound is played. Marking a heard signal only adds a timestamp.

Android Chromium converts interim dictation hypotheses into final results in continuous mode. Appending each such result can duplicate evolving prefixes. This test replaces the current run's displayed text with the newest nonempty hypothesis, and appends completed runs once. It preserves deliberately repeated words and separate runs. This is a test hypothesis: if the native provider returns independent phrases rather than cumulative hypotheses, earlier phrases could disappear. Compare the visible text with the raw result slots and report this; do not adopt the strategy in the exam until checked on real devices.

Chromium can terminate even a continuous session after native `onResults`; continuous does not guarantee an endless session. Web Speech exposes no switch for muting browser/system recognition signals. The user's observation that restart reduction reduced sounds supports a session-boundary signal hypothesis, but actual Galaxy recordings and event logs are still needed to establish the cause.

Sources: [Chromium Android implementation](https://raw.githubusercontent.com/chromium/chromium/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java), [Web Speech specification](https://webaudio.github.io/web-speech-api/).

## Galaxy test

In Chrome and Samsung Internet, test A, B and C separately with the phone sound enabled. Reset between tests. Dictate the same three English sentences for about 60 seconds, pausing 2–3 seconds between sentences. Include “very very good” and corrections. Whenever a signal sounds, press the signal counter button. Compare start/end counts and signal counts. C may require pressing resume after termination; record that interruption too.

Check missing phrases, duplicate prefixes, intentional repeated words, final text after stop, and no restart after stop or tab hiding. Compare sound mode and silent mode without changing the selected experiment. Download each log after testing. Export includes mode, user agent, timestamps and event counts, but no dictated text or audio. Raw recognition results stay on the page and are cleared by reset/reload.

Automated fake-recognizer tests verify event handling, snapshot replacement, intentional repetition, manual resume, timer cancellation, fatal errors, and preview guarding. They cannot verify Galaxy signals or the native provider's actual segmentation.
