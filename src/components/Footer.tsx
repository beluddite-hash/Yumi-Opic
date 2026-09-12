export default function Footer() {
  return <footer className="mt-16 border-t border-line pb-2 pt-6">
    <p className="text-xs leading-relaxed text-fg-muted"><strong className="text-success-ink">기출 복원 기반</strong> 문항은 공개된 수험자 복원·기출 정리 자료에 반복해서 등장하는 질문을 연습하기 좋게 다듬은 것입니다. 공식 OPIc 원문이거나 실제 출제를 보장하는 것은 아닙니다.</p>
    <p className="mt-3 text-xs leading-relaxed text-fg-muted"><strong className="text-fg">출제 유형 기반</strong> 문항은 복원 자료가 없는 주제에서도 비교·이슈·경험 유형을 연습할 수 있도록 실제 시험의 출제 유형에 맞춰 만든 문항입니다.</p>
    <p className="mt-3 text-xs leading-relaxed text-fg-muted">서베이 11개 주제와 돌발 7개 주제를 연습할 수 있습니다. 돌발 문항은 제공 자료의 지문과 번호를 따릅니다. 문제 낭독 MP3는 AI로 생성한 음성입니다.</p>
    <p className="mt-4 text-xs text-fg-subtle">© {new Date().getFullYear()} Yumi Kim. All rights reserved.</p>
  </footer>;
}
