import type { Question, QuestionSource, QuestionType } from "../lib/types";

function rp(
  id: string,
  type: QuestionType,
  en: string,
  ko: string,
  source: QuestionSource = "verified",
  dependsOn?: string[],
): Question {
  return { id, type, en, ko, source, dependsOn };
}

/**
 * Q11 -> Q12 -> Q13 roleplay sets for the active survey topics.
 *
 * `verified` means the prompt is grounded in publicly available OPIc recall /
 * question-compilation material and then lightly normalized for this app. It does
 * NOT mean ACTFL has officially released or authenticated the exact wording.
 *
 * Keep `adapted` only where a directly matching public Q12/Q13 continuation was
 * not found and the prompt was completed from the established roleplay pattern.
 */
export const surveyRoleplayQuestionsByTopic: Record<string, Question[]> = {
  home: [
    rp("home-rp11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You recently moved into a new apartment and need to learn the recycling rules. Call the management office and ask three or four questions about when, where, and how to recycle different kinds of waste.", "새 아파트로 이사한 뒤 재활용 규칙을 알아보는 상황입니다. 관리사무소에 전화해 언제, 어디서, 어떤 방식으로 재활용하는지 3~4가지 질문하세요."),
    rp("home-rp12", "roleplay_problem", "I'm sorry, but there is a problem I need you to resolve. A new resident in your apartment building is putting regular garbage into the recycling area, and other residents are upset. Talk to the resident, explain the recycling rules, and suggest two or three ways to fix the problem.", "새 입주민이 일반 쓰레기를 재활용 구역에 버려 다른 주민들이 불편해하고 있습니다. 그 입주민에게 규칙을 설명하고 문제를 해결할 방법 2~3가지를 제안하세요.", "verified", ["home-rp11"]),
    rp("home-rp13", "roleplay_experience", "That's the end of the situation. Tell me about a time when you had trouble with recycling, such as not knowing the rules after moving or putting something in the wrong container. What happened, what did you do, and how was the problem resolved?", "이사 후 규칙을 몰랐거나 잘못된 수거함에 버리는 등 재활용 때문에 곤란했던 경험을 말하세요. 무슨 일이 있었고 어떻게 해결했는지 설명하세요.", "verified", ["home-rp12"]),
  ],

  music: [
    rp("music-rp11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You want to buy an MP3 player, and your friend knows a lot about them. Call your friend and ask three or four questions that will help you decide what to buy.", "MP3 플레이어를 사려고 하는데 친구가 관련 제품을 잘 압니다. 친구에게 전화해 구매 결정에 도움이 되는 질문을 3~4가지 하세요."),
    rp("music-rp12", "roleplay_problem", "I'm sorry, but there is a problem I need you to resolve. You borrowed your friend's MP3 player and accidentally broke it. Call your friend, explain what happened and the condition of the player, and offer two or three alternatives to solve the problem.", "친구에게 빌린 MP3 플레이어를 실수로 고장 냈습니다. 친구에게 전화해 상황과 현재 상태를 설명하고 해결책 2~3가지를 제안하세요.", "verified", ["music-rp11"]),
    rp("music-rp13", "roleplay_experience", "That's the end of the situation. Tell me about a time when a music device or another piece of equipment you were using broke or stopped working. What exactly happened, and how did you deal with the problem?", "음악 기기나 사용하던 장비가 고장 나거나 작동을 멈춘 경험을 말하세요. 정확히 무슨 일이 있었고 어떻게 대처했는지 설명하세요.", "verified", ["music-rp12"]),
  ],

  beach: [
    rp("beach-roleplay1-q11", "roleplay_ask", "I'll give you a situation and ask you to act it out. Imagine that you want to go to a beach. Invite your friend to a beach and ask several questions to set the time and place to go there with him or her.", "상황을 드릴 테니 역할극을 해 주세요. 해변에 가고 싶다고 상상해 보세요. 친구를 해변에 초대하고 함께 갈 시간과 장소를 정하기 위해 여러 가지 질문을 해 주세요.", "provided"),
    rp("beach-roleplay1-q12", "roleplay_problem", "I'm sorry, but there is a problem that I need you to resolve. On the day of your beach trip, the weather is terrible. Call your friend, explain the situation, and make plans to go to the beach next time.", "죄송하지만 해결해 주셔야 할 문제가 있습니다. 해변 여행 당일 날씨가 매우 나쁩니다. 친구에게 전화해서 상황을 설명하고 다음에 해변에 갈 계획을 세워 주세요.", "provided", ["beach-roleplay1-q11"]),
    rp("beach-roleplay1-q13", "roleplay_experience", "That's the end of the situation. Was there a time when you couldn't go on a trip to the beach because of the bad weather? What was the weather like and how did you deal with the situation?", "상황극은 여기까지입니다. 나쁜 날씨 때문에 해변 여행을 가지 못했던 적이 있나요? 날씨가 어땠고 상황에 어떻게 대처했나요?", "provided", ["beach-roleplay1-q12"]),
  ],

  park: [
    rp("park-roleplay1-q11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. A friend wants to go to a park with you this weekend. Call your friend and ask three or four questions to go there with him or her.", "상황을 드릴 테니 역할극을 해 주세요. 친구가 이번 주말에 함께 공원에 가고 싶어 합니다. 친구에게 전화해서 함께 가기 위해 필요한 질문을 서너 가지 해 주세요.", "provided"),
    rp("park-roleplay1-q12", "roleplay_problem", "I'm sorry, but there is a problem that I need you to resolve. You are supposed to pick your friend up in an hour to go to the park together. However, you have a problem and cannot go to the park. Call your friend and explain the situation. Give two or three alternatives about what to do.", "죄송하지만 해결해 주셔야 할 문제가 있습니다. 한 시간 뒤 친구를 태우고 함께 공원에 가기로 했는데, 문제가 생겨 공원에 갈 수 없습니다. 친구에게 전화해 상황을 설명하고 무엇을 할지 두세 가지 대안을 제안해 주세요.", "provided", ["park-roleplay1-q11"]),
    rp("park-roleplay1-q13", "roleplay_experience", "That's the end of the situation. Have you ever bought concert tickets or made plans for a trip, or made plans for other things, but had to cancel at the last minute because you could not make it? When was it? What exactly happened? Tell me everything that you did to resolve the situation.", "상황극은 여기까지입니다. 콘서트 티켓을 사거나 여행 또는 다른 일을 계획했지만 참석할 수 없어 마지막 순간에 취소했던 적이 있나요? 언제였나요? 정확히 무슨 일이 있었나요? 상황을 해결하기 위해 했던 모든 일을 말해 주세요.", "provided", ["park-roleplay1-q12"]),
    rp("park-roleplay2-q11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. A friend wants to go to a park with you this weekend. Call your friend and ask three or four questions to go there with him or her.", "상황을 드릴 테니 역할극을 해 주세요. 친구가 이번 주말에 함께 공원에 가고 싶어 합니다. 친구에게 전화해서 함께 가기 위해 필요한 질문을 서너 가지 해 주세요.", "provided"),
    rp("park-roleplay2-q12", "roleplay_problem", "I'm sorry, but there is a problem that I need you to resolve. You've just learned on the news that the park you are planning to visit will be closed this weekend. Call your friend, explain the situation and offer two or three alternatives to the problem.", "죄송하지만 해결해 주셔야 할 문제가 있습니다. 방문하려던 공원이 이번 주말에 문을 닫는다는 소식을 방금 뉴스에서 들었습니다. 친구에게 전화해 상황을 설명하고 문제를 해결할 두세 가지 대안을 제안해 주세요.", "provided", ["park-roleplay2-q11"]),
    rp("park-roleplay2-q13", "roleplay_experience", "That’s the end of the situation. Tell me the story of one very memorable experience you had while visiting a park. Maybe something funny, unexpected, or wonderful happened. Start by giving me some background about when and where this took place. And then, tell me why it was so unforgettable or special.", "상황극은 여기까지입니다. 공원을 방문했을 때 겪은 아주 기억에 남는 경험을 이야기해 주세요. 재미있거나 예상하지 못한 일, 멋진 일이 있었을 수도 있겠네요. 언제 어디에서 있었던 일인지 배경부터 설명하고, 왜 그렇게 잊을 수 없거나 특별했는지 말해 주세요.", "provided", ["park-roleplay2-q12"]),
  ],

  concert: [
    rp("concert-rp11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You want to buy two tickets for a concert or performance for you and a friend. Call the ticket office and ask three or four questions to get the tickets.", "친구와 함께 볼 콘서트나 공연 티켓 두 장을 사고 싶습니다. 예매처에 전화해 티켓 구매에 필요한 정보를 3~4가지 질문하세요."),
    rp("concert-rp12", "roleplay_problem", "I'm sorry, but there is a problem I need you to resolve. On the day of the concert or performance, you become very sick and cannot go. Call your friend, explain the situation, and offer two or three alternatives.", "공연 당일 몸이 너무 아파서 갈 수 없게 됐습니다. 친구에게 전화해 상황을 설명하고 대안 2~3가지를 제안하세요.", "verified", ["concert-rp11"]),
    rp("concert-rp13", "roleplay_experience", "That's the end of the situation. Have you ever bought tickets or made plans for an event but had to cancel or change them because something unexpected happened? Tell me when it happened, what went wrong, what you did, and how it ended.", "공연이나 행사 표를 샀거나 계획을 세웠다가 예상치 못한 일로 취소하거나 변경했던 경험을 말하세요. 배경, 문제, 행동, 결과를 자세히 설명하세요.", "verified", ["concert-rp12"]),
  ],

  shopping: [
    rp("shopping-rp11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You see a sign saying that one of your favorite stores is having a big sale. Call or go to the store and ask three or four questions to find out as much as you can about the sale.", "좋아하는 매장에서 큰 세일을 한다는 안내를 봤습니다. 매장에 전화하거나 직접 가서 세일에 대해 3~4가지 질문하세요."),
    rp("shopping-rp12", "roleplay_problem", "I'm sorry, but there is a problem I need you to resolve. After you get home with an item you bought, you realize that it is damaged. Call the store, explain the situation, and offer two or three ways to resolve the problem.", "구매한 물건을 집에 가져온 뒤 손상된 것을 발견했습니다. 매장에 전화해 상황을 설명하고 해결 방법 2~3가지를 제안하세요.", "verified", ["shopping-rp11"]),
    rp("shopping-rp13", "roleplay_experience", "That's the end of the situation. Have you ever bought something that did not work, was damaged, or caused another shopping problem? Tell me what you bought, what was wrong, what you did, and how the problem was resolved.", "작동하지 않거나 손상된 물건을 샀거나 쇼핑 중 다른 문제를 겪었던 경험을 말하세요. 무엇을 샀고 무엇이 문제였으며 어떻게 해결했는지 설명하세요.", "verified", ["shopping-rp12"]),
  ],

  jogging: [
    rp("jogging-rp11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. Your friend has asked you to go jogging together. Call your friend and ask three or four questions about the time, place, route, or other details of the plan.", "친구가 같이 조깅하자고 했습니다. 친구에게 전화해 시간, 장소, 코스 등 계획에 대해 3~4가지 질문하세요."),
    rp("jogging-rp12", "roleplay_problem", "I'm sorry, but there is a problem I need you to resolve. You and your friend were supposed to go jogging together, but you cannot make it. Call your friend, explain the situation, and offer two or three alternatives.", "친구와 함께 조깅하기로 했지만 갈 수 없게 됐습니다. 친구에게 전화해 상황을 설명하고 대안 2~3가지를 제안하세요.", "verified", ["jogging-rp11"]),
    rp("jogging-rp13", "roleplay_experience", "That's the end of the situation. Tell me about a time when a jogging or exercise plan with someone had to be canceled or changed because of an unexpected problem. What happened, what did you do, and how did it turn out?", "누군가와 함께 하려던 조깅이나 운동 계획이 예상치 못한 문제로 취소되거나 변경된 경험을 말하세요. 무슨 일이 있었고 어떻게 대처했으며 결과는 어땠는지 설명하세요.", "verified", ["jogging-rp12"]),
  ],

  walking: [
    rp("walking-rp11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You want to go for a walk with your friend. Call your friend and ask three or four questions about walking together.", "친구와 함께 산책하거나 걷고 싶습니다. 친구에게 전화해 함께 걷는 계획에 대해 3~4가지 질문하세요."),
    rp("walking-rp12", "roleplay_problem", "I'm sorry, but there is a problem I need you to resolve. You planned to go for a walk with your friend, but bad weather or another unexpected problem makes the original plan difficult. Call your friend, explain the situation, and offer two or three alternatives.", "친구와 걷기로 했지만 날씨나 예상치 못한 문제 때문에 원래 계획대로 하기 어렵습니다. 친구에게 전화해 상황을 설명하고 대안 2~3가지를 제안하세요.", "adapted", ["walking-rp11"]),
    rp("walking-rp13", "roleplay_experience", "That's the end of the situation. Have you ever had a walking or outdoor plan changed because of bad weather or another unexpected problem? Tell me what happened, what you did instead, and how things turned out.", "날씨나 예상치 못한 문제 때문에 산책이나 야외 계획이 바뀐 경험을 말하세요. 무슨 일이 있었고 대신 무엇을 했으며 결과는 어땠는지 설명하세요.", "adapted", ["walking-rp12"]),
  ],

  gym: [
    rp("gym-roleplay1-q11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You are interested in joining a new gym that has recently opened in your town. Call the gym and ask three or four questions to get some information about the gym.", "상황을 드릴 테니 역할극을 해 주세요. 동네에 최근 새로 문을 연 헬스장에 가입하고 싶습니다. 헬스장에 전화해서 정보를 얻기 위한 질문을 서너 가지 해 주세요.", "provided"),
    rp("gym-roleplay1-q12", "roleplay_problem", "I'm sorry, but there is a problem that I need you to resolve. You were supposed to go to the gym with your friend today, but something unexpected came up and you can't make it. Call your friend, explain the situation, suggest two or three solutions, and make new plans to go to the gym together another day.", "죄송하지만 해결해 주셔야 할 문제가 있습니다. 오늘 친구와 헬스장에 가기로 했지만 뜻밖의 일이 생겨 갈 수 없습니다. 친구에게 전화해서 상황을 설명하고 두세 가지 해결책을 제안한 뒤 다른 날 함께 헬스장에 갈 새 계획을 세워 주세요.", "provided", ["gym-roleplay1-q11"]),
    rp("gym-roleplay1-q13", "roleplay_experience", "That’s the end of the situation. Have you ever made plans to do something with a friend but couldn’t make it because something unexpected happened? Tell me about the experience in detail. Explain what you had planned to do, what happened, why you couldn’t go, and how you handled the situation from beginning to end.", "상황극은 여기까지입니다. 친구와 무언가를 하기로 했지만 뜻밖의 일이 생겨 가지 못했던 적이 있나요? 그 경험을 자세히 말해 주세요. 무엇을 하기로 했고 무슨 일이 생겼으며 왜 가지 못했는지, 어떻게 대처했는지 처음부터 끝까지 설명해 주세요.", "provided", ["gym-roleplay1-q12"]),
  ],

  staycation: [
    rp("staycation-q11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You want to get two tickets to see a performance during your vacation. Call the box office and ask three or four questions to get tickets.", "상황을 듣고 역할을 수행해 주세요. 휴가 동안 볼 공연 티켓 두 장을 구하려고 합니다. 매표소에 전화해 티켓 구매를 위한 질문을 서너 가지 하세요."),
    rp("staycation-q12", "roleplay_problem", "I'm sorry, but there is a problem that I need you to resolve. On the day of the performance, you are very sick. Call your friend, explain the situation, and offer two different options to resolve the situation.", "해결해야 할 문제가 있습니다. 공연 당일 몸이 많이 아픕니다. 친구에게 전화해 상황을 설명하고 해결할 수 있는 서로 다른 대안 두 가지를 제안하세요.", "verified", ["staycation-q11"]),
    rp("staycation-q13", "roleplay_experience", "That's the end of the situation. Have you ever bought concert tickets or made plans for a trip, or made plans for other things, but had to cancel at the last minute because you could not make it? When was it? What exactly happened? Tell me everything that you did to resolve the situation", "상황극이 끝났습니다. 콘서트 티켓을 사거나 여행 또는 다른 계획을 세웠지만 참석할 수 없어 직전에 취소했던 적이 있나요? 언제였고 정확히 무슨 일이 있었나요? 상황을 해결하기 위해 했던 모든 일을 말해 주세요.", "verified", ["staycation-q12"]),
  ],

  overseas: [
    rp("overseas-roleplay1-q11", "roleplay_ask", "I'd like to give you a situation and ask you to act it out. You are planning on going on a trip. Call a travel agency and ask three or four questions about the trip you want to go on.", "상황을 드릴 테니 역할극을 해 주세요. 여행을 계획하고 있습니다. 여행사에 전화해서 가고 싶은 여행에 관한 질문을 서너 가지 해 주세요.", "provided"),
    rp("overseas-roleplay1-q12", "roleplay_problem", "I'm sorry, but there is a problem that I need you to resolve. When you arrive at the airport, you were told that your flight is canceled and other flights are completely booked. Call your travel agency, explain the situation, and make two or three suggestions to resolve the situation.", "죄송하지만 해결해 주셔야 할 문제가 있습니다. 공항에 도착하니 항공편이 취소되었고 다른 항공편은 모두 예약이 찼다는 말을 들었습니다. 여행사에 전화해서 상황을 설명하고 해결을 위한 제안을 두세 가지 해 주세요.", "provided", ["overseas-roleplay1-q11"]),
    rp("overseas-roleplay1-q13", "roleplay_experience", "That's the end of the situation. Have you ever had to deal with problems caused by canceled flight tickets? Describe that experience in detail. Tell me when and where this took place and what exactly happened. Talk about that experience from beginning to end.", "상황극은 여기까지입니다. 항공권 취소로 생긴 문제에 대처해야 했던 적이 있나요? 그 경험을 자세히 설명해 주세요. 언제 어디에서 있었고 정확히 무슨 일이 일어났는지 말해 주세요. 처음부터 끝까지 이야기해 주세요.", "provided", ["overseas-roleplay1-q12"]),
    rp("overseas-roleplay2-q11", "roleplay_ask", "You are visiting New York on vacation. You go to a car rental agency to rent a car. Imagine you are speaking to a rental car agent and ask three or four questions about renting a car for a week.", "휴가로 뉴욕에 방문했습니다. 차를 빌리기 위해 렌터카 회사에 갑니다. 직원과 대화한다고 상상하고 일주일 동안 차를 빌리는 것에 대해 질문을 서너 가지 해 주세요.", "provided"),
    rp("overseas-roleplay2-q12", "roleplay_problem", "I'm not sure if I can let you rent a car because I'm not familiar with your non-US driver's license. Can you explain to me what the license says and why it is the same as a valid US license?", "미국 외 국가의 운전면허증을 잘 몰라서 차를 빌려드릴 수 있을지 모르겠습니다. 면허증에 무엇이 적혀 있고 왜 유효한 미국 면허증과 같은지 설명해 주시겠어요?", "provided", ["overseas-roleplay2-q11"]),
    rp("overseas-roleplay2-q13", "roleplay_experience", "That’s the end of the situation. Sometimes, something out of the ordinary happens while travelling. I wonder if you have ever experienced anything surprising, unexpected or unusual during a trip. Tell me about that experience. Start by telling when and where you were traveling, and then give me all the details of that experience.", "상황극은 여기까지입니다. 여행 중에는 때때로 평소와 다른 일이 생깁니다. 여행 중 놀랍거나 예상하지 못했거나 특이한 일을 겪은 적이 있는지 궁금합니다. 그 경험을 말해 주세요. 언제 어디를 여행하고 있었는지부터 말하고, 그 경험의 모든 세부 사항을 설명해 주세요.", "provided", ["overseas-roleplay2-q12"]),
  ],
};

export const surveyRoleplayQuestionCount = Object.values(surveyRoleplayQuestionsByTopic)
  .reduce((sum, questions) => sum + questions.length, 0);
