import type { Question, QuestionSource, QuestionType, Topic } from "../lib/types";
import { surveyRoleplayQuestionsByTopic } from "./survey-roleplay-bank";
import { surveyPracticeSets } from "./survey-practice-sets";

export const SURVEY_BANK_VERSION = "survey-staycation-2026-09-10";

function q(
  id: string,
  type: QuestionType,
  en: string,
  ko: string,
  source: QuestionSource = "verified",
): Question {
  return { id, type, en, ko, source };
}

function topic(id: string, ko: string, en: string, emoji: string, questions: Question[]): Topic {
  return { id, category: "survey", ko, en, emoji, questions: [...questions, ...(surveyRoleplayQuestionsByTopic[id] ?? [])],
    ...(surveyPracticeSets[id] ? { fixedPracticeSets: surveyPracticeSets[id] } : {}) };
}

export const surveyTopics: Topic[] = [
  topic("home", "혼자 아파트 거주", "Home / Apartment", "🏠", [
    q("home-d1", "description", "Tell me about the apartment you live in. What does it look like, and what kinds of rooms does it have?", "현재 살고 있는 아파트를 설명해 주세요. 어떻게 생겼고 어떤 방들이 있나요?"),
    q("home-d2", "description", "Which room in your home do you like the most? Describe the room and explain what you usually do there.", "집에서 가장 좋아하는 방은 어디인가요? 그 방을 묘사하고 주로 무엇을 하는지 말해 주세요."),
    q("home-r1", "routine", "What do you usually do at home on a normal weekday or weekend? Walk me through your usual routine.", "평일이나 주말에 집에서 보통 무엇을 하나요? 평소 루틴을 순서대로 말해 주세요."),
    q("home-e1", "experience", "Tell me about a change you made to your home recently. What did you change, why did you change it, and how did it turn out?", "최근 집에 변화를 준 경험을 말해 주세요. 무엇을 왜 바꿨고 결과는 어땠나요?"),
    q("home-e2", "experience", "Think back to a time when you moved into a new home. What happened on moving day, and who helped you?", "새 집으로 이사했던 때를 떠올려 보세요. 이사 당일 무슨 일이 있었고 누가 도와줬나요?"),
    q("home-m1", "memorable", "Tell me about a memorable or unexpected problem you experienced at home. What happened, what did you do, and how was it resolved?", "집에서 겪은 기억에 남거나 예상 밖의 문제를 말해 주세요. 무슨 일이 있었고 어떻게 해결했나요?"),
    q("home-c1", "comparison", "Compare the home you lived in when you were younger with the home you live in now. What are the main similarities and differences?", "어릴 때 살던 집과 지금 사는 집을 비교해 주세요. 주요 공통점과 차이점은 무엇인가요?"),
    q("home-i1", "issue", "What housing or rental problems do people commonly talk about where you live? Why do these problems happen, and what could improve the situation?", "당신이 사는 지역에서 사람들이 자주 이야기하는 주거·임대 문제는 무엇인가요? 왜 생기며 어떻게 개선할 수 있을까요?", "adapted"),
  ]),
  topic("music", "음악 듣기", "Listening to Music", "🎧", [
    q("music-d1", "description", "What kinds of music do you enjoy listening to? Who are some singers or musicians you especially like, and what makes their music appealing to you?", "어떤 음악을 즐겨 듣나요? 특히 좋아하는 가수나 뮤지션은 누구이며 그 음악의 어떤 점이 좋나요?"),
    q("music-d2", "description", "Choose one musician you really like. Describe that person's music, style, and what makes the musician stand out to you.", "정말 좋아하는 뮤지션 한 명을 골라 음악과 스타일, 특별한 점을 설명해 주세요."),
    q("music-r1", "routine", "When and where do you usually listen to music? What device or service do you use, and what role does music play in your day?", "보통 언제 어디서 음악을 듣나요? 어떤 기기나 서비스를 쓰며 음악이 일상에서 어떤 역할을 하나요?"),
    q("music-e1", "experience", "How did you first become interested in music? What did you listen to at first, and who or what influenced you?", "처음 음악에 관심을 갖게 된 계기는 무엇인가요? 처음 어떤 음악을 들었고 누가 또는 무엇이 영향을 줬나요?"),
    q("music-e2", "experience", "Tell me about a recent time when you listened to live music. Where were you, who were you with, and what was the atmosphere like?", "최근 라이브 음악을 들었던 경험을 말해 주세요. 어디였고 누구와 있었으며 분위기는 어땠나요?"),
    q("music-m1", "memorable", "Tell me about a special or unforgettable experience you have had with music. What was the occasion, what music was playing, and why does that day still stay with you?", "음악과 관련해 특별하거나 잊을 수 없는 경험을 말해 주세요. 어떤 상황이었고 어떤 음악이 흘러나왔으며 그날이 왜 아직도 기억에 남나요?"),
    q("music-m2", "memorable", "Tell me about the most memorable live music or performance you have ever experienced. Where was it, who was performing, and what made that day stay with you?", "지금까지 경험한 라이브 음악이나 공연 중 가장 기억에 남는 것을 말해 주세요. 어디였고 누가 공연했으며 그날이 왜 기억에 남나요?"),
    q("music-c1", "comparison", "How has your taste in music changed from when you were younger to now? Give specific examples of what you listened to then and what you listen to today.", "어릴 때와 지금의 음악 취향은 어떻게 달라졌나요? 과거와 현재에 듣는 음악을 구체적으로 비교해 주세요."),
    q("music-c2", "comparison", "Compare two different kinds of music you listen to. How are they different in sound, mood, and the situations you listen to them in, and which one do you prefer?", "듣는 음악 중 서로 다른 두 종류를 비교해 주세요. 소리, 분위기, 듣는 상황은 어떻게 다르며 어느 쪽을 더 좋아하나요?"),
    q("music-i1", "issue", "What new electronic gadgets or equipment are people who like music interested in these days? What new products excite them, and why?", "요즘 음악을 좋아하는 사람들은 어떤 새로운 전자기기나 장비에 관심이 있나요? 어떤 신제품에 열광하며 그 이유는 무엇인가요?"),
  ]),
  topic("beach", "해변", "Beaches", "🏖️", [
    q("beach-set1-q2", "description", "You indicated in the survey that you go to the beach. Tell me about a beach that you like to go to. What does this place look like?", "설문에서 해변에 간다고 하셨습니다. 즐겨 가는 해변을 말해 주세요. 그곳은 어떻게 생겼나요?", "provided"),
    q("beach-set1-q3", "routine", "What kinds of things do you like to do when you go to the beach? Tell me about the activities you typically do there when you go to the beach.", "해변에 가면 어떤 일을 좋아하나요? 해변에 갈 때 보통 하는 활동을 말해 주세요.", "provided"),
    q("beach-set1-q4", "experience", "Tell me about a particularly memorable or beautiful beach that you have visited. What did this place look like? What was your impression of that place? Tell me in detail about what this special place looked like.", "방문했던 해변 중 특히 기억에 남거나 아름다웠던 곳을 말해 주세요. 어떻게 생겼나요? 어떤 인상을 받았나요? 그 특별한 곳의 모습을 자세히 설명해 주세요.", "provided"),
    q("beach-set2-q2", "description", "You indicated in the survey that you go to the beach. Tell me about a beach that you like to go to. What does this place look like?", "설문에서 해변에 간다고 하셨습니다. 즐겨 가는 해변을 말해 주세요. 그곳은 어떻게 생겼나요?", "provided"),
    q("beach-set2-q3", "routine", "What kinds of things do you like to do when you go to the beach? Tell me about the activities you typically do there when you go to the beach.", "해변에 가면 어떤 일을 좋아하나요? 해변에 갈 때 보통 하는 활동을 말해 주세요.", "provided"),
    q("beach-set2-q4", "experience", "Tell me about the beach that you went to recently. What did it look like? What did you like about that beach? Describe it in detail.", "최근에 갔던 해변을 말해 주세요. 어떻게 생겼나요? 어떤 점이 좋았나요? 자세히 설명해 주세요.", "provided"),
    q("beach-set3-q5", "description", "You indicated in the survey that you go to the beach. Tell me about a beach that you like to go to. What does this place look like?", "설문에서 해변에 간다고 하셨습니다. 즐겨 가는 해변을 말해 주세요. 그곳은 어떻게 생겼나요?", "provided"),
    q("beach-set3-q6", "experience", "Tell me about the beach that you went to recently. What did it look like? What did you like about that beach? Describe it in detail.", "최근에 갔던 해변을 말해 주세요. 어떻게 생겼나요? 어떤 점이 좋았나요? 자세히 설명해 주세요.", "provided"),
    q("beach-set3-q7", "memorable", "Tell me about a particularly memorable trip to the beach. Who were you with? Which beach were you at? What did you do there? What made this trip to the beach more memorable or special? Tell me everything you did from the moment you arrived there.", "특히 기억에 남는 해변 여행을 말해 주세요. 누구와 함께였고 어느 해변이었나요? 무엇을 했나요? 무엇 때문에 더 기억에 남거나 특별했나요? 도착한 순간부터 했던 모든 일을 말해 주세요.", "provided"),
    q("beach-set4-q5", "description", "You indicated in the survey that you go to the beach. Tell me about a beach that you like to go to. What does this place look like?", "설문에서 해변에 간다고 하셨습니다. 즐겨 가는 해변을 말해 주세요. 그곳은 어떻게 생겼나요?", "provided"),
    q("beach-set4-q6", "experience", "Tell me about a particularly memorable or beautiful beach that you have visited. What did this place look like? What was your impression of that place? Tell me in detail about what this special place looked like. ", "방문했던 해변 중 특히 기억에 남거나 아름다웠던 곳을 말해 주세요. 어떻게 생겼나요? 어떤 인상을 받았나요? 그 특별한 곳의 모습을 자세히 설명해 주세요.", "provided"),
    q("beach-set4-q7", "memorable", "Tell me about a particularly memorable trip to the beach. Who were you with? Which beach were you at? What did you do there? What made this trip to the beach more memorable or special? Tell me everything you did from the moment you arrived there.", "특히 기억에 남는 해변 여행을 말해 주세요. 누구와 함께였고 어느 해변이었나요? 무엇을 했나요? 무엇 때문에 더 기억에 남거나 특별했나요? 도착한 순간부터 했던 모든 일을 말해 주세요.", "provided"),
    q("beach-set5-q8", "description", "You indicated in the survey that you go to the beach. Tell me about a beach that you like to go to. What does this place look like?", "설문에서 해변에 간다고 하셨습니다. 즐겨 가는 해변을 말해 주세요. 그곳은 어떻게 생겼나요?", "provided"),
    q("beach-set5-q9", "experience", "Tell me about the beach that you went to recently. What did it look like? What did you like about that beach? Describe it in detail.", "최근에 갔던 해변을 말해 주세요. 어떻게 생겼나요? 어떤 점이 좋았나요? 자세히 설명해 주세요.", "provided"),
    q("beach-set5-q10", "memorable", "Tell me about a particularly memorable trip to the beach. Who were you with? Which beach were you at? What did you do there? What made this trip to the beach more memorable or special? Tell me everything you did from the moment you arrived there.", "특히 기억에 남는 해변 여행을 말해 주세요. 누구와 함께였고 어느 해변이었나요? 무엇을 했나요? 무엇 때문에 더 기억에 남거나 특별했나요? 도착한 순간부터 했던 모든 일을 말해 주세요.", "provided"),
    q("beach-set6-q8", "description", "You indicated in the survey that you go to the beach. Tell me about a beach that you like to go to. What does this place look like?", "설문에서 해변에 간다고 하셨습니다. 즐겨 가는 해변을 말해 주세요. 그곳은 어떻게 생겼나요?", "provided"),
    q("beach-set6-q9", "experience", "Tell me about a particularly memorable or beautiful beach that you have visited. What did this place look like? What was your impression of that place? Tell me in detail about what this special place looked like. ", "방문했던 해변 중 특히 기억에 남거나 아름다웠던 곳을 말해 주세요. 어떻게 생겼나요? 어떤 인상을 받았나요? 그 특별한 곳의 모습을 자세히 설명해 주세요.", "provided"),
    q("beach-set6-q10", "memorable", "Tell me about a particularly memorable trip to the beach. Who were you with? Which beach were you at? What did you do there? What made this trip to the beach more memorable or special? Tell me everything you did from the moment you arrived there.", "특히 기억에 남는 해변 여행을 말해 주세요. 누구와 함께였고 어느 해변이었나요? 무엇을 했나요? 무엇 때문에 더 기억에 남거나 특별했나요? 도착한 순간부터 했던 모든 일을 말해 주세요.", "provided"),
    q("beach-advanced1-q14", "comparison", "You indicated in the survey that you enjoy going to beaches. Pick two different beaches that you've ever been to. What does each of the beaches look like? Talk about their similarities and differences, and explain which one you prefer and why. ", "설문에서 해변에 가는 것을 즐긴다고 하셨습니다. 가 본 서로 다른 해변 두 곳을 고르세요. 각각 어떻게 생겼나요? 공통점과 차이점을 말하고 어느 곳을 더 좋아하는지, 그 이유를 설명해 주세요.", "provided"),
    q("beach-advanced1-q15", "issue", "What are some issues or concerns people have about beaches? What has caused these problems? What should be done to protect beaches and address these issues?", "사람들이 해변에 대해 갖는 문제나 우려에는 무엇이 있나요? 무엇이 이러한 문제를 일으켰나요? 해변을 보호하고 문제를 해결하기 위해 무엇을 해야 하나요?", "provided"),
  ]),
  topic("park", "공원", "Parks", "🌳", [
    q("park-set1-q2", "description", "You indicated in the survey that you go to parks with adults. Tell me about the kinds of parks that you like to visit. What do parks look like?", "설문에서 어른들과 공원에 간다고 하셨네요. 어떤 종류의 공원을 방문하는 것을 좋아하나요? 공원은 어떻게 생겼나요?", "provided"),
    q("park-set1-q3", "routine", "What kind of activities do you usually do at the park? Do you take walks or exercise at the park? Do you prefer to go there with others, or do you prefer to go alone? Please describe a typical day at the park.", "공원에서 보통 어떤 활동을 하나요? 산책이나 운동을 하나요? 다른 사람들과 함께 가는 것을 좋아하나요, 아니면 혼자 가는 것을 좋아하나요? 공원에서 보내는 평소의 하루를 설명해 주세요.", "provided"),
    q("park-set1-q4", "experience", "Tell me about the last time you went to a park. Which park was it? When was it that you went? Tell me everything you did from the moment you arrived at the park to the time you left.", "가장 최근에 공원에 갔던 경험을 이야기해 주세요. 어느 공원이었나요? 언제 갔나요? 공원에 도착한 순간부터 떠날 때까지 했던 모든 일을 말해 주세요.", "provided"),
    q("park-set2-q5", "description", "You indicated in the survey that you go to parks with adults. Tell me about the kinds of parks that you like to visit. What do parks look like?", "설문에서 어른들과 공원에 간다고 하셨네요. 어떤 종류의 공원을 방문하는 것을 좋아하나요? 공원은 어떻게 생겼나요?", "provided"),
    q("park-set2-q6", "experience", "Tell me about the last time you went to a park. Which park was it? When was it that you went? Tell me everything you did from the moment you arrived at the park to the time you left.", "가장 최근에 공원에 갔던 경험을 이야기해 주세요. 어느 공원이었나요? 언제 갔나요? 공원에 도착한 순간부터 떠날 때까지 했던 모든 일을 말해 주세요.", "provided"),
    q("park-set2-q7", "memorable", "Tell me about a memorable experience you had at a park. Maybe there was a special event, or maybe something unexpected happened. Begin by giving me some background about when and where it was. And then, give me all the details about what happened.", "공원에서 겪은 기억에 남는 경험을 이야기해 주세요. 특별한 행사가 있었거나 예상하지 못한 일이 생겼을 수도 있겠네요. 언제 어디에서 있었던 일인지 배경부터 설명하고, 무슨 일이 있었는지 자세히 말해 주세요.", "provided"),
    q("park-set3-q8", "description", "You indicated in the survey that you go to parks with adults. Tell me about the kinds of parks that you like to visit. What do parks look like?", "설문에서 어른들과 공원에 간다고 하셨네요. 어떤 종류의 공원을 방문하는 것을 좋아하나요? 공원은 어떻게 생겼나요?", "provided"),
    q("park-set3-q9", "experience", "Tell me about the last time you went to a park. Which park was it? When was it that you went? Tell me everything you did from the moment you arrived at the park to the time you left.", "가장 최근에 공원에 갔던 경험을 이야기해 주세요. 어느 공원이었나요? 언제 갔나요? 공원에 도착한 순간부터 떠날 때까지 했던 모든 일을 말해 주세요.", "provided"),
    q("park-set3-q10", "memorable", "Tell me about a memorable experience you had at a park. Maybe there was a special event, or maybe something unexpected happened. Begin by giving me some background about when and where it was. And then, give me all the details about what happened.", "공원에서 겪은 기억에 남는 경험을 이야기해 주세요. 특별한 행사가 있었거나 예상하지 못한 일이 생겼을 수도 있겠네요. 언제 어디에서 있었던 일인지 배경부터 설명하고, 무슨 일이 있었는지 자세히 말해 주세요.", "provided"),
    q("park-advanced1-q14", "comparison", "Compare the activities that children do at parks with those that adults do while they are there. What are the differences? How are the facilities at parks for children and adults different?", "아이들이 공원에서 하는 활동과 어른들이 공원에서 하는 활동을 비교해 주세요. 어떤 차이가 있나요? 공원에서 어린이를 위한 시설과 어른을 위한 시설은 어떻게 다른가요?", "provided"),
    q("park-advanced1-q15", "issue", "I'd like to know about one of the issues today's parks are faced with. What are the challenges public parks are facing these days? Discuss what has caused these concerns. What kinds of steps need to be taken to address those issues?", "오늘날 공원이 겪는 문제 중 하나에 대해 알고 싶습니다. 요즘 공공 공원은 어떤 어려움을 겪고 있나요? 이런 우려가 생긴 원인을 이야기해 주세요. 이러한 문제를 해결하려면 어떤 조치를 취해야 할까요?", "provided"),
    q("park-advanced2-q14", "comparison", "Pick two popular parks that you know of, and tell me about their similarities and differences. Which one do you prefer and why?", "알고 있는 인기 있는 공원 두 곳을 골라 공통점과 차이점을 설명해 주세요. 어느 공원을 더 좋아하며, 그 이유는 무엇인가요?", "provided"),
    q("park-advanced2-q15", "issue", "I'd like to know about one of the issues today's parks are faced with. What are the challenges public parks are facing these days? Discuss what has caused these concerns. What kinds of steps need to be taken to address those issues?", "오늘날 공원이 겪는 문제 중 하나에 대해 알고 싶습니다. 요즘 공공 공원은 어떤 어려움을 겪고 있나요? 이런 우려가 생긴 원인을 이야기해 주세요. 이러한 문제를 해결하려면 어떤 조치를 취해야 할까요?", "provided"),
  ]),
  topic("concert", "콘서트", "Concerts", "🎤", [
    q("concert-d1", "description", "What kinds of concerts or live performances do you enjoy? Explain what you like about those performances.", "어떤 종류의 콘서트나 라이브 공연을 좋아하나요? 그런 공연의 어떤 점이 좋은지 설명해 주세요."),
    q("concert-d2", "description", "Tell me about a concert venue you often visit or know well. Where is it, what does it look like, and what do you like about it?", "자주 가거나 잘 아는 콘서트장을 말해 주세요. 어디에 있고 어떻게 생겼으며 어떤 점이 좋나요?"),
    q("concert-r1", "routine", "How often do you go to concerts, who do you usually go with, and what do you normally do before and after a show?", "콘서트에 얼마나 자주 가고 누구와 가나요? 공연 전후에는 보통 무엇을 하나요?"),
    q("concert-e1", "experience", "Tell me about a concert you attended recently. Where was it held, who did you go with, and how was the experience?", "최근에 간 콘서트를 말해 주세요. 어디에서 열렸고 누구와 갔으며 경험은 어땠나요?"),
    q("concert-e2", "experience", "Tell me about the first concert or live performance you remember attending. What was it like, and how did you feel?", "기억나는 첫 콘서트나 라이브 공연 경험을 말해 주세요. 어땠고 어떤 기분이었나요?", "adapted"),
    q("concert-m1", "memorable", "What is the most memorable concert you have attended? Who performed, what made it special, and why do you remember it so clearly?", "가장 기억에 남는 콘서트는 무엇인가요? 누가 공연했고 무엇이 특별했으며 왜 선명하게 기억하나요?"),
    q("concert-c1", "comparison", "How have concerts or live performances changed over the years in your country? Compare the past with the present and explain what you think of the changes.", "당신의 나라에서 콘서트나 라이브 공연은 수년간 어떻게 변했나요? 과거와 현재를 비교하고 변화에 대한 생각을 말해 주세요."),
    q("concert-i1", "issue", "What problems or concerns do concertgoers talk about these days, such as ticket prices, ticketing, crowding, or venue rules? What could be improved?", "요즘 콘서트 관객들이 티켓 가격, 예매, 혼잡, 공연장 규칙 등과 관련해 이야기하는 문제는 무엇인가요? 무엇을 개선할 수 있을까요?", "adapted"),
  ]),
  topic("shopping", "쇼핑", "Shopping", "🛍️", [
    q("shopping-d1", "description", "Tell me about a store or shopping center you often go to. What does it look like, and what kinds of things can you buy there?", "자주 가는 상점이나 쇼핑센터를 말해 주세요. 어떻게 생겼고 어떤 물건을 살 수 있나요?"),
    q("shopping-d2", "description", "Describe your favorite place to shop. Where is it, what sections or stores does it have, and why do you like it?", "가장 좋아하는 쇼핑 장소를 설명해 주세요. 어디에 있고 어떤 매장이나 구역이 있으며 왜 좋아하나요?"),
    q("shopping-r1", "routine", "When do you usually go shopping, who do you go with, and what do you typically do from the moment you arrive until you leave?", "보통 언제 누구와 쇼핑하나요? 도착해서 떠날 때까지 주로 무엇을 하나요?"),
    q("shopping-e1", "experience", "Tell me about the last time you went shopping. Where did you go, what were you looking for, and what did you end up buying?", "마지막 쇼핑 경험을 말해 주세요. 어디에 갔고 무엇을 찾았으며 결국 무엇을 샀나요?"),
    q("shopping-e2", "experience", "Tell me about a purchase you remember especially well. What did you buy, why did you hesitate or decide to buy it, and how did you feel afterward?", "특히 기억나는 구매 경험을 말해 주세요. 무엇을 샀고 왜 망설이거나 구매를 결정했으며 이후 기분은 어땠나요?", "adapted"),
    q("shopping-m1", "memorable", "Tell me about a problem you had with something you bought. What was wrong, what did you do about it, and how was the problem resolved?", "구매한 물건에 문제가 있었던 경험을 말해 주세요. 무엇이 문제였고 어떻게 대처했으며 어떻게 해결됐나요?"),
    q("shopping-c1", "comparison", "How has the way you shop changed compared with the past? Compare how you used to shop with how you shop now.", "예전과 비교해 쇼핑 방식이 어떻게 달라졌나요? 과거와 현재의 쇼핑 방식을 비교해 주세요."),
    q("shopping-i1", "issue", "What products or shopping services are especially popular these days? Why do people want them, and what trends do you notice?", "요즘 특히 인기 있는 제품이나 쇼핑 서비스는 무엇인가요? 사람들이 왜 원하며 어떤 트렌드가 보이나요?", "adapted"),
  ]),
  topic("jogging", "조깅", "Jogging", "🏃", [
    q("jogging-d1", "description", "Describe a place where you like to jog. What is the route like, and why is it a good place for jogging?", "조깅하기 좋아하는 장소를 설명해 주세요. 코스는 어떻고 왜 조깅하기 좋은가요?"),
    q("jogging-d2", "description", "Tell me what jogging is like for you. What do you need, how long do you usually jog, and how do you feel afterward?", "당신에게 조깅이 어떤 운동인지 말해 주세요. 무엇이 필요하고 보통 얼마나 뛰며 끝나고 어떤 기분인가요?"),
    q("jogging-r1", "routine", "How often do you go jogging, when do you usually go, and what do you do before, during, and after your jog?", "얼마나 자주 언제 조깅하나요? 뛰기 전, 중간, 후에 무엇을 하나요?"),
    q("jogging-e1", "experience", "Tell me about the last time you went jogging. Where did you go, who were you with, and what happened that day?", "마지막 조깅 경험을 말해 주세요. 어디에 갔고 누구와 있었으며 그날 무슨 일이 있었나요?"),
    q("jogging-e2", "experience", "When and why did you first start jogging? Did someone or something motivate you to begin?", "언제 왜 처음 조깅을 시작했나요? 누군가나 어떤 계기가 동기를 줬나요?"),
    q("jogging-m1", "memorable", "Tell me about a memorable jogging experience. Maybe something difficult, funny, or unexpected happened. What made the experience stand out?", "기억에 남는 조깅 경험을 말해 주세요. 힘들거나 재미있거나 예상 밖의 일이 있었나요? 무엇이 특별했나요?"),
    q("jogging-c1", "comparison", "Compare jogging with another type of exercise you know well. How are they different in difficulty, convenience, and benefits?", "조깅과 잘 아는 다른 운동을 비교해 주세요. 난이도, 편의성, 장점은 어떻게 다른가요?", "adapted"),
    q("jogging-i1", "issue", "What problems can people face when jogging outdoors, such as weather, traffic, injuries, or poor paths? What can make jogging safer and easier?", "야외 조깅을 할 때 날씨, 교통, 부상, 좋지 않은 길 같은 어떤 문제가 생길 수 있나요? 어떻게 더 안전하고 편하게 만들 수 있을까요?", "adapted"),
  ]),
  topic("walking", "걷기", "Walking", "🚶", [
    q("walking-d1", "description", "Describe a place where you enjoy walking. What does the area look like, and what do you like about walking there?", "걷기 좋아하는 장소를 설명해 주세요. 주변은 어떻게 생겼고 그곳에서 걷는 어떤 점이 좋은가요?"),
    q("walking-d2", "description", "Tell me about your usual walking route. What do you see along the way, and what makes the route comfortable or interesting?", "평소 걷는 코스를 말해 주세요. 길에서 무엇을 보고 무엇이 편안하거나 흥미롭게 만드나요?"),
    q("walking-r1", "routine", "How often do you go walking, when and where do you usually walk, and what do you typically do while walking?", "얼마나 자주 언제 어디서 걷나요? 걸으면서 보통 무엇을 하나요?"),
    q("walking-e1", "experience", "When did you first start walking regularly, and why did you decide to make it a habit?", "언제 처음 규칙적으로 걷기 시작했고 왜 습관으로 만들기로 했나요?"),
    q("walking-e2", "experience", "Tell me about the last time you went for a walk. Where did you go, who were you with, and what did you do?", "마지막으로 산책하거나 걸었던 경험을 말해 주세요. 어디에 갔고 누구와 무엇을 했나요?"),
    q("walking-m1", "memorable", "Tell me about a walking experience that was especially memorable. What happened, and why was it unforgettable?", "특히 기억에 남는 걷기 경험을 말해 주세요. 무슨 일이 있었고 왜 잊을 수 없나요?"),
    q("walking-c1", "comparison", "Compare walking with jogging or another exercise. Which is easier to fit into daily life, and what different benefits do they have?", "걷기와 조깅 또는 다른 운동을 비교해 주세요. 일상에 넣기 더 쉬운 것은 무엇이며 장점은 어떻게 다른가요?", "adapted"),
    q("walking-i1", "issue", "What makes a neighborhood good or bad for walking? Talk about sidewalks, crossings, traffic, lighting, or other safety issues and suggest improvements.", "어떤 동네가 걷기 좋거나 나쁜가요? 보도, 횡단보도, 교통, 조명 등 안전 문제를 말하고 개선 방법을 제안해 주세요.", "adapted"),
  ]),
  topic("gym", "헬스", "Working Out at a Gym", "🏋️", [
    q("gym-set1-q2", "description", "You indicated in the survey that you go to the gym. Tell me about the gym or health club you often go to. Where is it located? What does it look like? What types of things does the gym provide? ", "설문에서 헬스장에 간다고 하셨습니다. 자주 가는 헬스장이나 헬스클럽을 말해 주세요. 어디에 있나요? 어떻게 생겼나요? 어떤 것들을 제공하나요?", "provided"),
    q("gym-set1-q3", "routine", "Talk about your usual routine when you go to the gym. What do you typically do when you go there? When do you go and how do you prepare before and once you get there?", "헬스장에 갈 때의 평소 일과를 말해 주세요. 그곳에서 보통 무엇을 하나요? 언제 가고, 가기 전과 도착한 뒤에는 어떻게 준비하나요?", "provided"),
    q("gym-set1-q4", "experience", "How did you first become interested in working out? When did you first start going to the gym? Tell me about your first experience when you went to the gym in detail.", "처음 운동에 관심을 갖게 된 계기는 무엇인가요? 언제 처음 헬스장에 다니기 시작했나요? 처음 헬스장에 갔던 경험을 자세히 말해 주세요.", "provided"),
    q("gym-set2-q5", "description", "You indicated in the survey that you go to the gym. Tell me about the gym or health club you often go to. Where is it located? What does it look like? What types of things does the gym provide? ", "설문에서 헬스장에 간다고 하셨습니다. 자주 가는 헬스장이나 헬스클럽을 말해 주세요. 어디에 있나요? 어떻게 생겼나요? 어떤 것들을 제공하나요?", "provided"),
    q("gym-set2-q6", "experience", "How did you first become interested in working out? When did you first start going to the gym? Tell me about your first experience when you went to the gym in detail.", "처음 운동에 관심을 갖게 된 계기는 무엇인가요? 언제 처음 헬스장에 다니기 시작했나요? 처음 헬스장에 갔던 경험을 자세히 말해 주세요.", "provided"),
    q("gym-set2-q7", "memorable", "Could you tell me about an unusual or unexpected experience you had at the gym? What happened? And why was this experience so memorable? Tell me the unexpected experience while working out with as many details as possible.", "헬스장에서 겪은 특이하거나 예상하지 못했던 경험을 말해 주시겠어요? 무슨 일이 있었나요? 왜 그렇게 기억에 남았나요? 운동 중 겪었던 뜻밖의 경험을 최대한 자세히 말해 주세요.", "provided"),
    q("gym-set3-q8", "description", "You indicated in the survey that you go to the gym. Tell me about the gym or health club you often go to. Where is it located? What does it look like? What types of things does the gym provide? ", "설문에서 헬스장에 간다고 하셨습니다. 자주 가는 헬스장이나 헬스클럽을 말해 주세요. 어디에 있나요? 어떻게 생겼나요? 어떤 것들을 제공하나요?", "provided"),
    q("gym-set3-q9", "experience", "How did you first become interested in working out? When did you first start going to the gym? Tell me about your first experience when you went to the gym in detail.", "처음 운동에 관심을 갖게 된 계기는 무엇인가요? 언제 처음 헬스장에 다니기 시작했나요? 처음 헬스장에 갔던 경험을 자세히 말해 주세요.", "provided"),
    q("gym-set3-q10", "memorable", "Could you tell me about an unusual or unexpected experience you had at the gym? What happened? And why was this experience so memorable? Tell me the unexpected experience while working out with as many details as possible.", "헬스장에서 겪은 특이하거나 예상하지 못했던 경험을 말해 주시겠어요? 무슨 일이 있었나요? 왜 그렇게 기억에 남았나요? 운동 중 겪었던 뜻밖의 경험을 최대한 자세히 말해 주세요.", "provided"),
    q("gym-advanced1-q14", "comparison", "You indicated in the survey that you go to the gym or health club. Pick two gyms or health clubs that you know of, and tell me about their similarities and differences. Which one do you prefer and why?", "설문에서 헬스장이나 헬스클럽에 간다고 하셨습니다. 알고 있는 두 곳을 고르고 공통점과 차이점을 말해 주세요. 어느 곳을 더 좋아하며 그 이유는 무엇인가요?", "provided"),
    q("gym-advanced1-q15", "issue", "I'd like to know about one of the challenges gyms or health clubs are faced with. What are they are faced with these days? Discuss what has caused these concerns. What kinds of steps need to be taken to address these issues?", "헬스장이나 헬스클럽이 겪는 어려움 중 하나를 알고 싶습니다. 요즘 어떤 어려움에 직면해 있나요? 이러한 우려의 원인을 설명해 주세요. 이 문제들을 해결하기 위해 어떤 조치를 취해야 하나요?", "provided"),
  ]),
  topic("staycation", "집에서 보내는 휴가", "Vacation at Home", "🛋️", [
    q("staycation-q2", "description", "You indicated that you take vacations at home. Who are the people you would like to see and spend time with on your vacation?", "집에서 휴가를 보낸다고 하셨습니다. 휴가 동안 누구를 만나 함께 시간을 보내고 싶나요?"),
    q("staycation-q3", "routine", "Describe some of the things that you would like to do with people you visit or see during your vacation.", "휴가 동안 방문하거나 만나는 사람들과 함께 하고 싶은 일들을 설명해 주세요."),
    q("staycation-q4", "experience", "Describe exactly what you did during the last vacation that you spent at home. Give me a description of what you did from the first to the last day. Talk about all the people you saw and everything that you did.", "지난번 집에서 보낸 휴가 동안 정확히 무엇을 했는지 설명해 주세요. 첫날부터 마지막 날까지 만난 모든 사람과 했던 모든 일을 말해 주세요."),
    q("staycation-q5", "description", "You indicated that you take vacations at home. Who are the people you would like to see and spend time with on your vacation?", "집에서 휴가를 보낸다고 하셨습니다. 휴가 동안 누구를 만나 함께 시간을 보내고 싶나요?"),
    q("staycation-q6", "experience", "Describe exactly what you did during the last vacation that you spent at home. Give me a description of what you did from the first to the last day. Talk about all the people you saw and everything that you did.", "지난번 집에서 보낸 휴가 동안 정확히 무엇을 했는지 설명해 주세요. 첫날부터 마지막 날까지 만난 모든 사람과 했던 모든 일을 말해 주세요."),
    q("staycation-q7", "memorable", "Could you tell me about an unusual or unexpected experience you had during a vacation you had at home? What happened? Who was involved? And why was this experience so memorable?", "집에서 휴가를 보내며 겪은 특이하거나 예상하지 못한 경험을 말해 주세요. 무슨 일이 있었고 누가 관련되어 있었나요? 왜 그렇게 기억에 남나요?"),
    q("staycation-q14", "comparison", "You indicated in the survey that you stay at home for vacations. How do most people spend their vacation in your country? How does that compare to the way people spent their vacation when they were growing up? Are they doing things differently? How have things changed and why have things changed? Please, take a minute to discuss this topic.", "설문에서 집에서 휴가를 보낸다고 하셨습니다. 당신의 나라에서 대부분의 사람들은 휴가를 어떻게 보내나요? 그 사람들이 자라던 시절의 휴가 방식과 비교하면 어떤가요? 무엇이 어떻게, 왜 달라졌는지 이야기해 주세요."),
    q("staycation-q15", "issue", "Experts state that vacations are important for every individual. Take a minute and report for me the important benefits of vacation time to a person's health, relationships, and personal growth.", "전문가들은 휴가가 모든 사람에게 중요하다고 합니다. 휴가가 개인의 건강, 인간관계, 개인적 성장에 주는 중요한 이점을 이야기해 주세요."),
  ]),
  topic("overseas", "해외여행", "Overseas Travel", "✈️", [
    q("overseas-set1-q2", "description", "You indicated in the survey that you take vacations internationally. Could you describe for me one of the countries you have visited? What did it look like and what were the local people like there?", "설문에서 해외로 휴가를 간다고 하셨습니다. 방문한 나라 중 한 곳을 설명해 주시겠어요? 어떤 모습이었고 현지 사람들은 어땠나요?", "provided"),
    q("overseas-set1-q3", "routine", "Talk about the things that you typically do when you visit another country or overseas city.", "다른 나라나 해외 도시에 방문하면 보통 하는 일들을 말해 주세요.", "provided"),
    q("overseas-set1-q4", "experience", "Tell me about your first trip to another country or city. When did you go? Where did you visit? What did you do there? Who did you go with? Tell me everything about that trip with lots of details.", "다른 나라나 도시로 처음 여행했던 경험을 말해 주세요. 언제 갔고 어디를 방문했나요? 그곳에서 무엇을 했고 누구와 갔나요? 그 여행의 모든 것을 아주 자세히 말해 주세요.", "provided"),
    q("overseas-set2-q5", "description", "You indicated in the survey that you take vacations internationally. Could you describe for me one of the countries you have visited? What did it look like and what were the local people like there?", "설문에서 해외로 휴가를 간다고 하셨습니다. 방문한 나라 중 한 곳을 설명해 주시겠어요? 어떤 모습이었고 현지 사람들은 어땠나요?", "provided"),
    q("overseas-set2-q6", "experience", "Tell me about your first trip to another country or city. When did you go? Where did you visit? What did you do there? Who did you go with? Tell me everything about that trip with lots of details.", "다른 나라나 도시로 처음 여행했던 경험을 말해 주세요. 언제 갔고 어디를 방문했나요? 그곳에서 무엇을 했고 누구와 갔나요? 그 여행의 모든 것을 아주 자세히 말해 주세요.", "provided"),
    q("overseas-set2-q7", "memorable", "Traveling can lead to many kinds of interesting, funny and unexpected experience. Tell me about one travel experience you had that was unforgettable. Start by telling me when this happened, where you were, and who you were with. And then, tell me about all the things that happened, which made this experience so memorable.", "여행에서는 흥미롭고 재미있으며 예상하지 못한 여러 경험을 할 수 있습니다. 잊을 수 없었던 여행 경험 하나를 말해 주세요. 언제였고 어디에 있었으며 누구와 함께였는지부터 말해 주세요. 그런 다음 그 경험을 기억에 남게 했던 모든 일을 말해 주세요.", "provided"),
    q("overseas-set3-q8", "description", "You indicated in the survey that you take vacations internationally. Could you describe for me one of the countries you have visited? What did it look like and what were the local people like there?", "설문에서 해외로 휴가를 간다고 하셨습니다. 방문한 나라 중 한 곳을 설명해 주시겠어요? 어떤 모습이었고 현지 사람들은 어땠나요?", "provided"),
    q("overseas-set3-q9", "experience", "Tell me about your first trip to another country or city. When did you go? Where did you visit? What did you do there? Who did you go with? Tell me everything about that trip with lots of details.", "다른 나라나 도시로 처음 여행했던 경험을 말해 주세요. 언제 갔고 어디를 방문했나요? 그곳에서 무엇을 했고 누구와 갔나요? 그 여행의 모든 것을 아주 자세히 말해 주세요.", "provided"),
    q("overseas-set3-q10", "memorable", "Traveling can lead to many kinds of interesting, funny and unexpected experience. Tell me about one travel experience you had that was unforgettable. Start by telling me when this happened, where you were, and who you were with. And then, tell me about all the things that happened, which made this experience so memorable. ", "여행에서는 흥미롭고 재미있으며 예상하지 못한 여러 경험을 할 수 있습니다. 잊을 수 없었던 여행 경험 하나를 말해 주세요. 언제였고 어디에 있었으며 누구와 함께였는지부터 말해 주세요. 그런 다음 그 경험을 기억에 남게 했던 모든 일을 말해 주세요.", "provided"),
    q("overseas-advanced1-q14", "comparison", "You indicated in the survey that you take vacations internationally. How has traveling to other countries changed over the years? Is it easier or more difficult? Describe what travelling was like in the past and what changes you have seen over the years.", "설문에서 해외로 휴가를 간다고 하셨습니다. 다른 나라로 여행하는 것이 세월이 흐르며 어떻게 달라졌나요? 더 쉬워졌나요, 어려워졌나요? 과거의 여행이 어땠는지와 그동안 보아 온 변화를 설명해 주세요.", "provided"),
    q("overseas-advanced1-q15", "issue", "When people discuss traveling internationally, what kinds of things do they consider the most? Why are these things of such interest or importance to travelers? Tell me about the activities people want to try when traveling to other countries. Are there any places they want to go to or things they want to see?", "사람들이 해외여행을 이야기할 때 무엇을 가장 많이 고려하나요? 왜 여행자들에게 그렇게 흥미롭거나 중요한가요? 다른 나라를 여행할 때 사람들이 해 보고 싶어 하는 활동을 말해 주세요. 가고 싶은 장소나 보고 싶은 것이 있나요?", "provided"),
  ]),
];

export const DEFAULT_SURVEY_IDS = surveyTopics.map((topic) => topic.id);
export const surveyTopicById = new Map(surveyTopics.map((topic) => [topic.id, topic]));
export const surveyQuestionCount = surveyTopics.reduce((sum, topic) => sum + topic.questions.length, 0);

export const introQuestion: Question = q(
  "intro",
  "intro",
  "Let's start the interview. Please tell me a little bit about yourself.",
  "인터뷰를 시작하겠습니다. 자기소개를 해 주세요.",
  "adapted",
);
