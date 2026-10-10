# Android Chrome continuous 음성인식 실험

이 브랜치는 main 58d55bf에서 분리한 대안이다. PR #46의 코드와 미리보기는 변경하지 않는다.

## 원인과 처리 방식
과거 c7ca39a에서 확인한 중복의 원인은 Android Chromium이 continuous 모드의 provisional 결과를 final로 바꿔 전달하는 것이다. 예: 결과 칸에 I / I goat / I go to the gym이 함께 쌓인다. 기존 collectTranscript는 이 칸을 독립 문장으로 이어 붙였다.
이 실험에서는 Android Chrome에 continuous=true를 요청하고, 현재 세션 결과는 최신 비어 있지 않은 가설로 교체한다. 앞부분이 수정되어도 겹침 비교를 하지 않으므로 I goat가 남지 않는다. 이미 종료된 세션은 기존처럼 이어 붙인다. very very good처럼 실제 반복된 단어, 다른 세션에서 같은 문장을 다시 말하는 경우는 보존한다.
PC와 iOS의 결과 처리 및 continuous 설정, 녹음·AI 전사, 질문 음성, 답변 저장 코드는 유지한다.

## 종료와 알림음의 한계
사이트는 speechend나 결과 수신만으로 stop/start하지 않는다. continuous는 Android의 dictation mode 요청에 전달되므로 짧은 휴지의 종료가 줄어드는지 실기기로 확인한다.
Chromium은 인식 서비스의 최종 onResults 뒤에는 여전히 세션을 종료한다. 따라서 continuous=true만으로 무조건 한 세션이 끝까지 지속되거나 모든 알림음이 제거된다고 보장할 수 없다. 실제 onend 뒤 기존 재시작은 유지해 받아쓰기가 끊긴 채 방치되지 않게 한다.
최신 가설 교체는 현재 Android Chromium의 단일 native 세션 결과를 전제로 한다. 기기 서비스가 독립 문장을 별도 칸으로 반환한다면 이전 문장이 사라질 위험이 있으므로 반드시 여러 문장 테스트로 검증하고, 확인 전 병합하지 않는다.
원본: https://raw.githubusercontent.com/chromium/chromium/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java (handleResults, startRecognition, onResults)

## 갤럭시 테스트
운영 사이트, #46 미리보기, 이 PR 미리보기에서 같은 문장을 각각 테스트한다. 무음 모드가 아닌 소리 모드로 비교한다.
1. 60초 답변, 문장 사이 2~3초 휴지 5회: 알림음 횟수와 인식 누락을 비교한다.
2. I go to the gym every morning을 말하면서 중간 가설이 수정되어도 앞부분이 반복되지 않는지 확인한다.
3. 여러 서로 다른 문장을 이어 말한다. 최신 문장만 남고 앞 문장이 사라지면 테스트 실패다.
4. very very good, I like it it was fun 및 같은 문장 두 번을 말한다. 실제 반복은 남아야 한다.
5. 정지 직전 마지막 문장, 질문 다시 듣기, 다음 문항, 결과 화면에서 텍스트 보존을 확인한다.
6. PC에서 질문 음성, 녹음 재생, 기존 AI 전사·답변 저장을 확인한다.

## 선택적 진단
이 브랜치의 git-codex-mobile-continuous Vercel 별칭에서만 URL에 speechDebug=1을 추가하면 콘솔에 [YUMIOPIC speech] 이벤트가 기록된다. 답변 내용과 음성은 로그에 기록하지 않는다.
예: /exam?mode=full&speechDebug=1
Android Chrome USB 원격 디버깅 콘솔에서 start/end/stop/error 횟수를 확인한다. 소리가 start 시점과 일치하는지 확인하면 시스템 알림음 추정을 검증할 수 있다. 기기에서 음성을 인식하는 실제 Chrome·Android·One UI·음성 서비스 버전도 기록한다.
진단 로그는 정상 URL과 운영 도메인에서는 비활성이다.
