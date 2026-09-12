import type { FixedPracticeSet } from "../lib/types";

/**
 * 주제별 연습의 세트 순서와 실제 시험 번호만 정의한다. 질문 본문은 기존 문제은행에 둔다.
 * 다른 서베이 주제도 키와 세트 데이터를 추가하면 같은 빌더를 사용한다.
 */
export const surveyPracticeSets: Partial<Record<string, readonly FixedPracticeSet[]>> = {
  music: [
    { label: "COMBO 1", items: [
      {"slot":1,"displayNumber":"2","questionId":"music-set1-q2"},
      {"slot":2,"displayNumber":"3","questionId":"music-set1-q3"},
      {"slot":3,"displayNumber":"4","questionId":"music-set1-q4"},
    ] },
    { label: "COMBO 2", items: [
      {"slot":4,"displayNumber":"5","questionId":"music-set2-q5"},
      {"slot":5,"displayNumber":"6","questionId":"music-set2-q6"},
      {"slot":6,"displayNumber":"7","questionId":"music-set2-q7"},
    ] },
    { label: "COMBO 3", items: [
      {"slot":7,"displayNumber":"8","questionId":"music-set3-q8"},
      {"slot":8,"displayNumber":"9","questionId":"music-set3-q9"},
      {"slot":9,"displayNumber":"10","questionId":"music-set3-q10"},
    ] },
    { label: "ROLE-PLAY COMBO", items: [
      {"slot":10,"displayNumber":"11","questionId":"music-roleplay1-q11"},
      {"slot":11,"displayNumber":"12","questionId":"music-roleplay1-q12"},
      {"slot":12,"displayNumber":"13","questionId":"music-roleplay1-q13"},
    ] },
    { label: "ADVANCED COMBO", items: [
      {"slot":13,"displayNumber":"14","questionId":"music-advanced1-q14"},
      {"slot":14,"displayNumber":"15","questionId":"music-advanced1-q15"},
    ] },
  ],
  beach: [
    { label: "COMBO 1", items: [
      {"slot":1,"displayNumber":"2","questionId":"beach-set1-q2"},
      {"slot":2,"displayNumber":"3","questionId":"beach-set1-q3"},
      {"slot":3,"displayNumber":"4","questionId":"beach-set1-q4"},
    ] },
    { label: "COMBO 2", items: [
      {"slot":4,"displayNumber":"2","questionId":"beach-set2-q2"},
      {"slot":5,"displayNumber":"3","questionId":"beach-set2-q3"},
      {"slot":6,"displayNumber":"4","questionId":"beach-set2-q4"},
    ] },
    { label: "COMBO 3", items: [
      {"slot":7,"displayNumber":"5","questionId":"beach-set3-q5"},
      {"slot":8,"displayNumber":"6","questionId":"beach-set3-q6"},
      {"slot":9,"displayNumber":"7","questionId":"beach-set3-q7"},
    ] },
    { label: "COMBO 4", items: [
      {"slot":10,"displayNumber":"5","questionId":"beach-set4-q5"},
      {"slot":11,"displayNumber":"6","questionId":"beach-set4-q6"},
      {"slot":12,"displayNumber":"7","questionId":"beach-set4-q7"},
    ] },
    { label: "COMBO 5", items: [
      {"slot":13,"displayNumber":"8","questionId":"beach-set5-q8"},
      {"slot":14,"displayNumber":"9","questionId":"beach-set5-q9"},
      {"slot":15,"displayNumber":"10","questionId":"beach-set5-q10"},
    ] },
    { label: "COMBO 6", items: [
      {"slot":16,"displayNumber":"8","questionId":"beach-set6-q8"},
      {"slot":17,"displayNumber":"9","questionId":"beach-set6-q9"},
      {"slot":18,"displayNumber":"10","questionId":"beach-set6-q10"},
    ] },
    { label: "ROLE-PLAY COMBO", items: [
      {"slot":19,"displayNumber":"11","questionId":"beach-roleplay1-q11"},
      {"slot":20,"displayNumber":"12","questionId":"beach-roleplay1-q12"},
      {"slot":21,"displayNumber":"13","questionId":"beach-roleplay1-q13"},
    ] },
    { label: "ADVANCED COMBO", items: [
      {"slot":22,"displayNumber":"14","questionId":"beach-advanced1-q14"},
      {"slot":23,"displayNumber":"15","questionId":"beach-advanced1-q15"},
    ] },
  ],
  overseas: [
    { label: "COMBO 1", items: [
      {"slot":1,"displayNumber":"2","questionId":"overseas-set1-q2"},
      {"slot":2,"displayNumber":"3","questionId":"overseas-set1-q3"},
      {"slot":3,"displayNumber":"4","questionId":"overseas-set1-q4"},
    ] },
    { label: "COMBO 2", items: [
      {"slot":4,"displayNumber":"5","questionId":"overseas-set2-q5"},
      {"slot":5,"displayNumber":"6","questionId":"overseas-set2-q6"},
      {"slot":6,"displayNumber":"7","questionId":"overseas-set2-q7"},
    ] },
    { label: "COMBO 3", items: [
      {"slot":7,"displayNumber":"8","questionId":"overseas-set3-q8"},
      {"slot":8,"displayNumber":"9","questionId":"overseas-set3-q9"},
      {"slot":9,"displayNumber":"10","questionId":"overseas-set3-q10"},
    ] },
    { label: "ROLE-PLAY COMBO 1", items: [
      {"slot":10,"displayNumber":"11","questionId":"overseas-roleplay1-q11"},
      {"slot":11,"displayNumber":"12","questionId":"overseas-roleplay1-q12"},
      {"slot":12,"displayNumber":"13","questionId":"overseas-roleplay1-q13"},
    ] },
    { label: "ROLE-PLAY COMBO 2", items: [
      {"slot":13,"displayNumber":"11","questionId":"overseas-roleplay2-q11"},
      {"slot":14,"displayNumber":"12","questionId":"overseas-roleplay2-q12"},
      {"slot":15,"displayNumber":"13","questionId":"overseas-roleplay2-q13"},
    ] },
    { label: "ADVANCE COMBO", items: [
      {"slot":16,"displayNumber":"14","questionId":"overseas-advanced1-q14"},
      {"slot":17,"displayNumber":"15","questionId":"overseas-advanced1-q15"},
    ] },
  ],
  gym: [
    { label: "COMBO 1", items: [
      {"slot":1,"displayNumber":"2","questionId":"gym-set1-q2"},
      {"slot":2,"displayNumber":"3","questionId":"gym-set1-q3"},
      {"slot":3,"displayNumber":"4","questionId":"gym-set1-q4"},
    ] },
    { label: "COMBO 2", items: [
      {"slot":4,"displayNumber":"5","questionId":"gym-set2-q5"},
      {"slot":5,"displayNumber":"6","questionId":"gym-set2-q6"},
      {"slot":6,"displayNumber":"7","questionId":"gym-set2-q7"},
    ] },
    { label: "COMBO 3", items: [
      {"slot":7,"displayNumber":"8","questionId":"gym-set3-q8"},
      {"slot":8,"displayNumber":"9","questionId":"gym-set3-q9"},
      {"slot":9,"displayNumber":"10","questionId":"gym-set3-q10"},
    ] },
    { label: "ROLE-PLAY COMBO", items: [
      {"slot":10,"displayNumber":"11","questionId":"gym-roleplay1-q11"},
      {"slot":11,"displayNumber":"12","questionId":"gym-roleplay1-q12"},
      {"slot":12,"displayNumber":"13","questionId":"gym-roleplay1-q13"},
    ] },
    { label: "ADVANCE COMBO", items: [
      {"slot":13,"displayNumber":"14","questionId":"gym-advanced1-q14"},
      {"slot":14,"displayNumber":"15","questionId":"gym-advanced1-q15"},
    ] },
  ],
  park: [
    { label: "SET 1", items: [
      {"slot":1,"displayNumber":"2","questionId":"park-set1-q2"},
      {"slot":2,"displayNumber":"3","questionId":"park-set1-q3"},
      {"slot":3,"displayNumber":"4","questionId":"park-set1-q4"},
    ] },
    { label: "SET 2", items: [
      {"slot":4,"displayNumber":"5","questionId":"park-set2-q5"},
      {"slot":5,"displayNumber":"6","questionId":"park-set2-q6"},
      {"slot":6,"displayNumber":"7","questionId":"park-set2-q7"},
    ] },
    { label: "SET 3", items: [
      {"slot":7,"displayNumber":"8","questionId":"park-set3-q8"},
      {"slot":8,"displayNumber":"9","questionId":"park-set3-q9"},
      {"slot":9,"displayNumber":"10","questionId":"park-set3-q10"},
    ] },
    { label: "ROLEPLAY SET 1", items: [
      {"slot":10,"displayNumber":"11","questionId":"park-roleplay1-q11"},
      {"slot":11,"displayNumber":"12","questionId":"park-roleplay1-q12"},
      {"slot":12,"displayNumber":"13","questionId":"park-roleplay1-q13"},
    ] },
    { label: "ROLEPLAY SET 2", items: [
      {"slot":13,"displayNumber":"11","questionId":"park-roleplay2-q11"},
      {"slot":14,"displayNumber":"12","questionId":"park-roleplay2-q12"},
      {"slot":15,"displayNumber":"13","questionId":"park-roleplay2-q13"},
    ] },
    { label: "ADVANCED SET 1", items: [
      {"slot":16,"displayNumber":"14","questionId":"park-advanced1-q14"},
      {"slot":17,"displayNumber":"15","questionId":"park-advanced1-q15"},
    ] },
    { label: "ADVANCED SET 2", items: [
      {"slot":18,"displayNumber":"14","questionId":"park-advanced2-q14"},
      {"slot":19,"displayNumber":"15","questionId":"park-advanced2-q15"},
    ] },
  ],
  staycation: [
    { label: "Q2–Q4", items: [
      { slot: 2, displayNumber: "2", questionId: "staycation-q2" },
      { slot: 3, displayNumber: "3", questionId: "staycation-q3" },
      { slot: 4, displayNumber: "4", questionId: "staycation-q4" },
    ] },
    { label: "Q5–Q7", items: [
      { slot: 5, displayNumber: "5", questionId: "staycation-q5" },
      { slot: 6, displayNumber: "6", questionId: "staycation-q6" },
      { slot: 7, displayNumber: "7", questionId: "staycation-q7" },
    ] },
    { label: "Q11–Q13", items: [
      { slot: 11, displayNumber: "11", questionId: "staycation-q11" },
      { slot: 12, displayNumber: "12", questionId: "staycation-q12" },
      { slot: 13, displayNumber: "13", questionId: "staycation-q13" },
    ] },
    { label: "Q14–Q15", items: [
      { slot: 14, displayNumber: "14", questionId: "staycation-q14" },
      { slot: 15, displayNumber: "15", questionId: "staycation-q15" },
    ] },
  ],
};
