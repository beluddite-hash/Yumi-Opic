import type { Topic } from "../lib/types";
import { surveyPracticeSets } from "./survey-practice-sets";

/** 제공된 돌발 자료의 영어 지문·제목·번호·순서를 그대로 보존합니다. */
export const surpriseTopics: Topic[] = [
  {
    "id": "recycling",
    "category": "surprise",
    "ko": "재활용",
    "en": "Recycling",
    "emoji": "",
    "fixedPracticeSets": surveyPracticeSets.recycling,
    "questions": [
      {
        "id": "recycling-combo1-q2",
        "number": "2",
        "type": "description",
        "source": "provided",
        "en": "I would like to know about how recycling is practiced in your country. What do people specifically do? Tell me how things are recycled.",
        "ko": "당신의 나라에서는 재활용을 어떻게 하나요? 사람들이 구체적으로 무엇을 하는지, 물건이 어떻게 재활용되는지 알려 주세요."
      },
      {
        "id": "recycling-combo1-q3",
        "number": "3",
        "type": "routine",
        "source": "provided",
        "en": "Recycling is a common practice. Tell me about all the different kinds of things that you recycle.",
        "ko": "재활용은 흔히 하는 일입니다. 당신이 재활용하는 여러 종류의 물건을 모두 말해 주세요."
      },
      {
        "id": "recycling-combo1-q4",
        "number": "4",
        "type": "experience",
        "source": "provided",
        "en": "Tell me what recycling was like when you were a child. Was there a particular place to which you took out the recyclables? Were there any special containers? Describe what it was like and what you did in detail.",
        "ko": "어릴 때 재활용을 어떻게 했는지 말해 주세요. 재활용품을 가져가는 정해진 장소나 특별한 수거함이 있었나요? 당시 모습과 당신이 했던 일을 자세히 설명해 주세요."
      },
      {
        "id": "recycling-combo2-q5",
        "number": "5",
        "type": "description",
        "source": "provided",
        "en": "I would like to know about how recycling is practiced in your country. What do people specifically do? Tell me how things are recycled.",
        "ko": "당신의 나라에서는 재활용을 어떻게 하나요? 사람들이 구체적으로 무엇을 하는지, 물건이 어떻게 재활용되는지 알려 주세요."
      },
      {
        "id": "recycling-combo2-q6",
        "number": "6",
        "type": "experience",
        "source": "provided",
        "en": "Tell me what recycling was like when you were a child. Was there a particular place to which you took out the recyclables? Were there any special containers? Describe what it was like and what you did in detail.",
        "ko": "어릴 때 재활용을 어떻게 했는지 말해 주세요. 재활용품을 가져가는 정해진 장소나 특별한 수거함이 있었나요? 당시 모습과 당신이 했던 일을 자세히 설명해 주세요."
      },
      {
        "id": "recycling-combo2-q7",
        "number": "7",
        "type": "memorable",
        "source": "provided",
        "en": "Problems sometimes occur while recycling. Perhaps the pick-up service did not come as planned. Or, the items were too big for the containers. Or, the container was knocked over and some items spilled out. Tell me about something memorable related to recycling.",
        "ko": "재활용을 하다가 문제가 생기기도 합니다. 수거 서비스가 예정대로 오지 않거나, 물건이 수거함에 비해 너무 크거나, 수거함이 넘어져 내용물이 쏟아질 수 있습니다. 재활용과 관련해 기억에 남는 일을 말해 주세요."
      },
      {
        "id": "recycling-combo3-q8",
        "number": "8",
        "type": "description",
        "source": "provided",
        "en": "I would like to know about how recycling is practiced in your country. What do people specifically do? Tell me how things are recycled.",
        "ko": "당신의 나라에서는 재활용을 어떻게 하나요? 사람들이 구체적으로 무엇을 하는지, 물건이 어떻게 재활용되는지 알려 주세요."
      },
      {
        "id": "recycling-combo3-q9",
        "number": "9",
        "type": "experience",
        "source": "provided",
        "en": "Tell me what recycling was like when you were a child. Was there a particular place to which you took out the recyclables? Were there any special containers? Describe what it was like and what you did in detail.",
        "ko": "어릴 때 재활용을 어떻게 했는지 말해 주세요. 재활용품을 가져가는 정해진 장소나 특별한 수거함이 있었나요? 당시 모습과 당신이 했던 일을 자세히 설명해 주세요."
      },
      {
        "id": "recycling-combo3-q10",
        "number": "10",
        "type": "memorable",
        "source": "provided",
        "en": "Problems sometimes occur while recycling. Perhaps the pick-up service did not come as planned. Or, the items were too big for the containers. Or, the container was knocked over and some items spilled out. Tell me about something memorable related to recycling.",
        "ko": "재활용을 하다가 문제가 생기기도 합니다. 수거 서비스가 예정대로 오지 않거나, 물건이 수거함에 비해 너무 크거나, 수거함이 넘어져 내용물이 쏟아질 수 있습니다. 재활용과 관련해 기억에 남는 일을 말해 주세요."
      },
      {
        "id": "recycling-roleplay1-q11",
        "number": "11",
        "type": "roleplay_ask",
        "source": "provided",
        "en": "Suppose that you've just moved into a big apartment building. Call the person of the front desk and ask 3-4 questions about the building's recycling policy.",
        "ko": "큰 아파트 건물로 막 이사했다고 가정해 보세요. 안내 데스크 직원에게 전화하여 건물의 재활용 정책에 대해 서너 가지 질문을 하세요."
      },
      {
        "id": "recycling-roleplay1-q12",
        "number": "12",
        "type": "roleplay_problem",
        "source": "provided",
        "en": "A new resident from abroad has just rented an apartment in your building. However, he is throwing away garbage in the recycling bin. Other residents are very upset about that. Go to the new resident and explain the situation and tell him about the recycling policy.",
        "ko": "외국에서 온 새 주민이 아파트를 임대했지만 재활용함에 쓰레기를 버려 다른 주민들이 화가 났습니다. 새 주민에게 상황과 재활용 정책을 설명하세요."
      },
      {
        "id": "recycling-roleplay1-q13",
        "number": "13",
        "type": "roleplay_experience",
        "source": "provided",
        "en": "Tell me what recycling was like when you were a child. Was there a particular place you took out the recyclables to? How was recycling back then different from what you are doing now?",
        "ko": "어릴 때 재활용을 어떻게 했는지 말해 주세요. 재활용품을 가져가는 정해진 장소나 특별한 수거함이 있었나요? 당시 모습과 당신이 했던 일을 자세히 설명해 주세요."
      },
      {
        "id": "recycling-roleplay2-q11",
        "number": "11",
        "type": "roleplay_ask",
        "source": "provided",
        "en": "Suppose that you've just moved into a big apartment building. Call the person of the front desk and ask 3-4 questions about the building's recycling policy.",
        "ko": "큰 아파트 건물로 막 이사했다고 가정해 보세요. 안내 데스크 직원에게 전화하여 건물의 재활용 정책에 대해 서너 가지 질문을 하세요."
      },
      {
        "id": "recycling-roleplay2-q12",
        "number": "12",
        "type": "roleplay_problem",
        "source": "provided",
        "en": "You often host a large party and take out most of the recycling and garbage the next day. However, other residents in your building are not happy about it. One of them has come to complain to you. Explain your situation and offer several suggestions to resolve the problem.",
        "ko": "큰 파티를 자주 열고 다음 날 재활용품과 쓰레기를 내놓아 주민이 항의했습니다. 상황을 설명하고 해결책을 몇 가지 제안하세요."
      },
      {
        "id": "recycling-roleplay2-q13",
        "number": "13",
        "type": "roleplay_experience",
        "source": "provided",
        "en": "Describe a specific time in which you had trouble with recycling. It may have been a situation where you moved to a new place and did not know the rules. Or you put the materials in the wrong containers. Describe what happened from beginning to end.",
        "ko": "재활용 때문에 어려움을 겪었던 구체적인 때를 처음부터 끝까지 설명해 주세요."
      },
      {
        "id": "recycling-advanced1-q14",
        "number": "14",
        "type": "comparison",
        "source": "provided",
        "en": "The handling of recycling materials has changed over the years. Tell me how recycling materials were collected in the past and how this has evolved over the years.",
        "ko": "재활용품을 처리하는 방식은 세월이 흐르면서 바뀌었습니다. 과거에는 어떻게 수거했고, 그 방식이 시간이 지나면서 어떻게 달라졌는지 말해 주세요."
      },
      {
        "id": "recycling-advanced1-q15",
        "number": "15",
        "type": "issue",
        "source": "provided",
        "en": "Stories about recycling are often in the media. Tell me about one news story that you heard of related to the recycling or perhaps the environment. Describe what the story was about and what the reaction to the story was.",
        "ko": "재활용 관련 이야기는 언론에 자주 나옵니다. 재활용이나 환경에 관해 들은 뉴스 한 가지를 말해 주세요. 어떤 내용이었고 사람들이 어떻게 반응했는지 설명해 주세요."
      },
      {
        "id": "recycling-advanced2-q14",
        "number": "14",
        "type": "comparison",
        "source": "provided",
        "en": "Describe what the attitude was toward recycling when you were a child. Did people recycle then? Did they throw everything out in the garbage? What were people’s views on recycling at that time and how have they changed over the years?",
        "ko": "어릴 때 사람들이 재활용을 어떻게 생각했는지 설명해 주세요. 당시에도 재활용했나요, 아니면 모든 것을 쓰레기로 버렸나요? 당시의 인식과 그 인식이 시간이 지나면서 어떻게 바뀌었는지 말해 주세요."
      },
      {
        "id": "recycling-advanced2-q15",
        "number": "15",
        "type": "issue",
        "source": "provided",
        "en": "Stories about recycling are often in the media. Tell me about one news story that you heard of related to the recycling or perhaps the environment. Describe what the story was about and what the reaction to the story was.",
        "ko": "재활용 관련 이야기는 언론에 자주 나옵니다. 재활용이나 환경에 관해 들은 뉴스 한 가지를 말해 주세요. 어떤 내용이었고 사람들이 어떻게 반응했는지 설명해 주세요."
      }
    ]
  },
  {
    "id": "industry",
    "category": "surprise",
    "ko": "산업 & 취업",
    "en": "Industry & Employment",
    "emoji": "",
    "fixedPracticeSets": surveyPracticeSets.industry,
    "questions": [
      {
        "id": "industry-combo1-q2",
        "number": "2",
        "type": "description",
        "source": "provided",
        "en": "What are some of the companies that young people want to work for these days? Why do young people want to work for these companies?",
        "ko": "요즘 젊은 사람들이 일하고 싶어 하는 회사에는 어떤 곳들이 있나요? 왜 그 회사에서 일하고 싶어 하나요?"
      },
      {
        "id": "industry-combo1-q3",
        "number": "3",
        "type": "description",
        "source": "provided",
        "en": "Describe a company or industry in your country that is attractive to workers. When did this company or industry start? How has it become successful? What has made this company or industry so attractive to workers?",
        "ko": "당신의 나라에서 근로자에게 매력적인 회사나 산업을 설명해 주세요. 언제 시작됐고 어떻게 성공했나요? 어떤 점 때문에 근로자들에게 매력적이 되었나요?"
      },
      {
        "id": "industry-combo1-q4",
        "number": "4",
        "type": "experience",
        "source": "provided",
        "en": "What kinds of efforts have you made for your career in the past? Tell me about some individual efforts that you have made for your career.",
        "ko": "과거에 진로를 위해 어떤 노력을 했나요? 진로를 위해 개인적으로 기울인 노력들을 말해 주세요."
      },
      {
        "id": "industry-combo2-q5",
        "number": "5",
        "type": "description",
        "source": "provided",
        "en": "What are some of the companies that young people want to work for these days? Why do young people want to work for these companies?",
        "ko": "요즘 젊은 사람들이 일하고 싶어 하는 회사에는 어떤 곳들이 있나요? 왜 그 회사에서 일하고 싶어 하나요?"
      },
      {
        "id": "industry-combo2-q6",
        "number": "6",
        "type": "description",
        "source": "provided",
        "en": "Describe a company or industry in your country that is attractive to workers. When did this company or industry start? How has it become successful? What has made this company or industry so attractive to workers?",
        "ko": "당신의 나라에서 근로자에게 매력적인 회사나 산업을 설명해 주세요. 언제 시작됐고 어떻게 성공했나요? 어떤 점 때문에 근로자들에게 매력적이 되었나요?"
      },
      {
        "id": "industry-combo2-q7",
        "number": "7",
        "type": "routine",
        "source": "provided",
        "en": "What do people usually do to prepare for their future careers? How do they learn about the different types of industries and how do they get ready to apply for those jobs?",
        "ko": "사람들은 보통 미래의 진로를 위해 무엇을 준비하나요? 다양한 산업에 대해 어떻게 알아보고, 그 일자리에 지원할 준비를 어떻게 하나요?"
      },
      {
        "id": "industry-combo3-q5",
        "number": "5",
        "type": "description",
        "source": "provided",
        "en": "Tell me about one industry in your country that is well-known. You can talk about any industry such as the entertainment, technology, automotive industry or other industries. Pick one industry and tell me all about it.",
        "ko": "당신의 나라에서 잘 알려진 산업 하나를 말해 주세요. 엔터테인먼트, 기술, 자동차 등 어떤 산업이든 좋습니다. 하나를 골라 자세히 설명해 주세요."
      },
      {
        "id": "industry-combo3-q6",
        "number": "6",
        "type": "description",
        "source": "provided",
        "en": "Can you tell me about one promising or famous company in this particular industry? Tell me how the company started, and all the things that have happened that made it become so well-known?",
        "ko": "그 산업에서 유망하거나 유명한 회사 하나를 말해 주세요. 회사가 어떻게 시작됐고, 어떤 일들을 거쳐 유명해졌는지 설명해 주세요."
      },
      {
        "id": "industry-combo3-q7",
        "number": "7",
        "type": "experience",
        "source": "provided",
        "en": "When this company introduced its most important products, were they successful right away? Describe to me the challenges this company faced and how the company was able to succeed. Tell me in as much detail as you can.",
        "ko": "그 회사가 가장 중요한 제품을 출시했을 때 바로 성공했나요? 어떤 어려움을 겪었고 어떻게 성공할 수 있었는지 최대한 자세히 설명해 주세요."
      },
      {
        "id": "industry-combo4-q8",
        "number": "8",
        "type": "description",
        "source": "provided",
        "en": "What are some of the companies that young people want to work for these days? Why do young people want to work for these companies?",
        "ko": "요즘 젊은 사람들이 일하고 싶어 하는 회사에는 어떤 곳들이 있나요? 왜 그 회사에서 일하고 싶어 하나요?"
      },
      {
        "id": "industry-combo4-q9",
        "number": "9",
        "type": "description",
        "source": "provided",
        "en": "Describe a company or industry in your country that is attractive to workers. When did this company or industry start? How has it become successful? What has made this company or industry so attractive to workers?",
        "ko": "당신의 나라에서 근로자에게 매력적인 회사나 산업을 설명해 주세요. 언제 시작됐고 어떻게 성공했나요? 어떤 점 때문에 근로자들에게 매력적이 되었나요?"
      },
      {
        "id": "industry-combo4-q10",
        "number": "10",
        "type": "routine",
        "source": "provided",
        "en": "What do people usually do to prepare for their future careers? How do they learn about the different types of industries and how do they get ready to apply for those jobs?",
        "ko": "사람들은 보통 미래의 진로를 위해 무엇을 준비하나요? 다양한 산업에 대해 어떻게 알아보고, 그 일자리에 지원할 준비를 어떻게 하나요?"
      },
      {
        "id": "industry-combo5-q8",
        "number": "8",
        "type": "description",
        "source": "provided",
        "en": "Tell me about one industry in your country that is well-known. You can talk about any industry such as the entertainment, technology, automotive industry or other industries. Pick one industry and tell me all about it.",
        "ko": "당신의 나라에서 잘 알려진 산업 하나를 말해 주세요. 엔터테인먼트, 기술, 자동차 등 어떤 산업이든 좋습니다. 하나를 골라 자세히 설명해 주세요."
      },
      {
        "id": "industry-combo5-q9",
        "number": "9",
        "type": "description",
        "source": "provided",
        "en": "Can you tell me about one promising or famous company in this particular industry? Tell me how the company started, and all the things that have happened that made it become so well-known?",
        "ko": "그 산업에서 유망하거나 유명한 회사 하나를 말해 주세요. 회사가 어떻게 시작됐고, 어떤 일들을 거쳐 유명해졌는지 설명해 주세요."
      },
      {
        "id": "industry-combo5-q10",
        "number": "10",
        "type": "experience",
        "source": "provided",
        "en": "When this company introduced its most important products, were they successful right away? Describe to me the challenges this company faced and how the company was able to succeed. Tell me in as much detail as you can.",
        "ko": "그 회사가 가장 중요한 제품을 출시했을 때 바로 성공했나요? 어떤 어려움을 겪었고 어떻게 성공할 수 있었는지 최대한 자세히 설명해 주세요."
      },
      {
        "id": "industry-roleplay1-q11",
        "number": "11",
        "type": "roleplay_ask",
        "source": "provided",
        "en": "I'd like to give you a situation and ask you to act it out. You applied to a company to look for a new job. Ask a few questions to learn more about the position.",
        "ko": "새 일자리를 찾기 위해 회사에 지원했습니다. 그 직책에 대해 더 알아보기 위한 몇 가지 질문을 하세요."
      },
      {
        "id": "industry-roleplay1-q12",
        "number": "12",
        "type": "roleplay_problem",
        "source": "provided",
        "en": "I'm sorry, but there is a problem that I need you to resolve. You started at a new job, and some problems have come up that you can’t solve. Explain to your supervisor or colleagues what happened and ask for help to resolve the issues.",
        "ko": "새 직장에서 혼자 해결할 수 없는 문제가 생겼습니다. 상사나 동료에게 상황을 설명하고 도움을 요청하세요."
      },
      {
        "id": "industry-roleplay1-q13",
        "number": "13",
        "type": "roleplay_experience",
        "source": "provided",
        "en": "That's the end of the situation. Talk about an experience with a problem that occurred at your new job. Perhaps you were asked to work on an impossible project, or you didn’t agree with your boss. Explain how you resolved the issue.",
        "ko": "새 직장에서 문제가 발생했던 경험과 그것을 어떻게 해결했는지 설명해 주세요."
      },
      {
        "id": "industry-roleplay2-q11",
        "number": "11",
        "type": "roleplay_ask",
        "source": "provided",
        "en": "I’d like to give you a situation and ask you to act it out. Imagine that you have an interview for a job at a very important company. To prepare for the interview, you want to learn more about the company. Call the company and ask three or four questions to learn more about it.",
        "ko": "중요한 회사의 취업 면접을 준비하기 위해 회사에 전화하여 서너 가지 질문을 하세요."
      },
      {
        "id": "industry-roleplay2-q12",
        "number": "12",
        "type": "roleplay_problem",
        "source": "provided",
        "en": "I’m sorry, but there is a problem which I need you to resolve. Due to an emergency, you will not be able to attend your job interview. Call the company and leave a message explaining the situation. And then, offer two or three alternate plans so that you do not lose this opportunity.",
        "ko": "긴급 상황으로 면접에 참석할 수 없습니다. 회사에 상황을 설명하고 두세 가지 대안을 제시하세요."
      },
      {
        "id": "industry-roleplay2-q13",
        "number": "13",
        "type": "roleplay_experience",
        "source": "provided",
        "en": "That’s the end of the situation. Have you ever had to miss a class, a meeting or an interview at school or for work? Tell me the story of that experience. When did it happen and how did you resolve the situation? Give me lots of details.",
        "ko": "학교나 직장에서 수업, 회의 또는 면접에 참석하지 못했던 경험과 해결 방법을 자세히 말해 주세요."
      },
      {
        "id": "industry-advanced1-q14",
        "number": "14",
        "type": "comparison",
        "source": "provided",
        "en": "Tell me about an industry you follow. Is it related to food, energy, or mobile computing? How is it different from three years ago?",
        "ko": "관심 있게 지켜보는 산업을 말해 주세요. 식품, 에너지, 모바일 컴퓨팅과 관련된 산업인가요? 3년 전과 어떻게 다른가요?"
      },
      {
        "id": "industry-advanced1-q15",
        "number": "15",
        "type": "issue",
        "source": "provided",
        "en": "Tell me about an incident that occurred in the industry you follow. Perhaps a game company released a new game, but the public was disappointed about it. Or perhaps a company released a new device, but it didn't meet people's expectations. How did your community react to the incident?",
        "ko": "관심 있게 지켜보는 산업에서 일어난 사건을 말해 주세요. 게임 회사의 신작이나 회사가 출시한 새 기기가 대중의 기대에 못 미쳤을 수도 있습니다. 당신의 커뮤니티는 그 사건에 어떻게 반응했나요?"
      },
      {
        "id": "industry-advanced2-q14",
        "number": "14",
        "type": "comparison",
        "source": "provided",
        "en": "How do people prepare for future work in your country's industries? Do they get general education first or receive specific training once they join a company? Do they receive specific job training from a young age? How has the process changed over the past 5 years? Give me all the details.",
        "ko": "당신의 나라에서 사람들은 산업 분야의 미래 업무를 어떻게 준비하나요? 먼저 일반 교육을 받나요, 입사한 뒤 전문 훈련을 받나요? 어린 나이부터 특정 직업 훈련을 받기도 하나요? 지난 5년간 그 과정이 어떻게 달라졌는지 자세히 말해 주세요."
      },
      {
        "id": "industry-advanced2-q15",
        "number": "15",
        "type": "issue",
        "source": "provided",
        "en": "What is an industry or a company that people in your country are talking about nowadays? Tell me why people are interested in this industry and what they are saying about it.",
        "ko": "요즘 당신의 나라에서 사람들이 이야기하는 산업이나 회사는 무엇인가요? 왜 관심을 갖고 있으며 어떤 이야기를 하는지 말해 주세요."
      }
    ]
  },
  {
    "id": "job-hunting",
    "category": "surprise",
    "ko": "구직·진로",
    "en": "Job Hunting & Career",
    "emoji": "",
    "questions": [
      {
        "id": "job-hunting-q1",
        "number": "1",
        "title": "Companies Young People Want to Work For",
        "type": "description",
        "source": "provided",
        "en": "What are some of the companies that young people want to work for these days? Why do young people want to work for these companies?",
        "ko": "요즘 젊은 사람들이 일하고 싶어 하는 회사에는 어떤 곳들이 있나요? 왜 그 회사에서 일하고 싶어 하나요?"
      },
      {
        "id": "job-hunting-q2",
        "number": "2",
        "title": "An Attractive Company or Industry",
        "type": "description",
        "source": "provided",
        "en": "Describe a company or industry in your country that is attractive to workers. When did this company or industry start? How has it become successful? What has made this company or industry so attractive to workers?",
        "ko": "당신의 나라에서 근로자에게 매력적인 회사나 산업을 설명해 주세요. 언제 시작됐고 어떻게 성공했나요? 어떤 점 때문에 근로자들에게 매력적이 되었나요?"
      },
      {
        "id": "job-hunting-q3",
        "number": "3",
        "title": "Preparing for a Future Career",
        "type": "routine",
        "source": "provided",
        "en": "What do people usually do to prepare for their future careers? How do they learn about the different types of industries, and how do they get ready to apply for those jobs?",
        "ko": "사람들은 보통 미래의 진로를 위해 무엇을 준비하나요? 다양한 산업에 대해 어떻게 알아보고, 그 일자리에 지원할 준비를 어떻게 하나요?"
      },
      {
        "id": "job-hunting-q4",
        "number": "4",
        "title": "Career Education & Training",
        "type": "comparison",
        "source": "provided",
        "en": "How do people prepare for future work in your country's industries? Do they get general education first or receive specific training once they join a company? Do they receive specific job training from a young age? How has the process changed over the past five years? Give me all the details.",
        "ko": "당신의 나라에서 사람들은 산업 분야의 미래 업무를 어떻게 준비하나요? 먼저 일반 교육을 받나요, 입사한 뒤 전문 훈련을 받나요? 어린 나이부터 특정 직업 훈련을 받기도 하나요? 지난 5년간 그 과정이 어떻게 달라졌는지 자세히 말해 주세요."
      },
      {
        "id": "job-hunting-q5",
        "number": "5",
        "title": "A Company or Industry People Are Talking About",
        "type": "issue",
        "source": "provided",
        "en": "What is an industry or a company that people in your country are talking about nowadays? Tell me why people are interested in this industry and what they are saying about it.",
        "ko": "요즘 당신의 나라에서 사람들이 이야기하는 산업이나 회사는 무엇인가요? 왜 관심을 갖고 있으며 어떤 이야기를 하는지 말해 주세요."
      }
    ]
  },
  {
    "id": "workplaces",
    "category": "surprise",
    "ko": "직업·직장",
    "en": "Jobs & Workplaces",
    "emoji": "",
    "questions": [
      {
        "id": "workplaces-q1",
        "number": "1",
        "title": "Common Jobs & Workplaces in Your Country",
        "type": "description",
        "source": "provided",
        "en": "What kinds of places do people in your country usually work at? Tell me about the common types of jobs and workplaces in your country.",
        "ko": "당신의 나라에서 사람들은 보통 어떤 곳에서 일하나요? 흔한 직업과 직장 유형에 대해 말해 주세요."
      },
      {
        "id": "workplaces-q2",
        "number": "2",
        "title": "Jobs & Popular Workplaces in Your Area",
        "type": "description",
        "source": "provided",
        "en": "What kinds of jobs do people in your area usually have? What kinds of workplaces are popular among people these days? Tell me about where people work and what these workplaces are like.",
        "ko": "당신의 지역 사람들은 주로 어떤 직업을 갖고 있나요? 요즘 어떤 직장이 인기 있나요? 사람들이 일하는 곳과 그곳의 모습을 말해 주세요."
      },
      {
        "id": "workplaces-q3",
        "number": "3",
        "title": "Changes in Jobs in Your Area",
        "type": "comparison",
        "source": "provided",
        "en": "How have jobs in your area changed compared to the past? What kinds of jobs did people use to have, and what kinds of jobs do they have now?",
        "ko": "당신의 지역의 직업은 과거와 비교해 어떻게 바뀌었나요? 예전에는 어떤 직업을 가졌고 지금은 어떤 직업을 갖고 있나요?"
      },
      {
        "id": "workplaces-q4",
        "number": "4",
        "title": "A Memorable Experience at an Early Job",
        "type": "memorable",
        "source": "provided",
        "en": "Can you tell me about an early job you had after graduating? Did you have a particularly memorable experience at that early job? Please explain in detail.",
        "ko": "졸업 후 초기에 가졌던 직업에 대해 말해 주세요. 그 직장에서 특히 기억에 남는 경험이 있었나요? 자세히 설명해 주세요."
      },
      {
        "id": "workplaces-q5",
        "number": "5",
        "title": "Changes in Workplaces",
        "type": "comparison",
        "source": "provided",
        "en": "Have there been any changes in workplaces in your country from the past to now? What changes have happened? Please tell me all about them.",
        "ko": "당신의 나라의 직장은 과거부터 지금까지 달라진 점이 있나요? 어떤 변화가 있었는지 자세히 말해 주세요."
      },
      {
        "id": "workplaces-q6",
        "number": "6",
        "title": "Changes in Jobs Due to Technology",
        "type": "issue",
        "source": "provided",
        "en": "There have been changes in professions due to the development of technology. What are some recent professional trends in your country? Please describe them in detail.",
        "ko": "기술의 발달로 직업에도 변화가 생겼습니다. 당신의 나라에서 나타나는 최근 직업 동향에는 무엇이 있나요? 자세히 설명해 주세요."
      }
    ]
  },
  {
    "id": "doctors",
    "category": "surprise",
    "ko": "병원·치과",
    "en": "Doctors & Dentists",
    "emoji": "",
    "questions": [
      {
        "id": "doctors-q1",
        "number": "1",
        "title": "A Doctor's or Dentist's Office",
        "type": "description",
        "source": "provided",
        "en": "I'd like to know about the doctor's or dentist's office that you usually go to. Where is it located, and what does it look like? Tell me about it in as much detail as you can.",
        "ko": "평소 다니는 병원이나 치과에 대해 알고 싶습니다. 어디에 있고 어떤 모습인가요? 최대한 자세히 말해 주세요."
      },
      {
        "id": "doctors-q2",
        "number": "2",
        "title": "Making a Doctor or Dentist Appointment",
        "type": "routine",
        "source": "provided",
        "en": "What kinds of things do you do when you make appointments with a doctor or dentist? Tell me exactly what you do from beginning to end.",
        "ko": "병원이나 치과 진료를 예약할 때 무엇을 하나요? 처음부터 끝까지 정확하게 설명해 주세요."
      },
      {
        "id": "doctors-q3",
        "number": "3",
        "title": "Going to a Doctor or Dentist as a Child",
        "type": "experience",
        "source": "provided",
        "en": "Talk about a time when you went to see a doctor or dentist as a child. Why did you go there? What did you do, and what happened when you got there? Tell me about the experience in detail.",
        "ko": "어릴 때 병원이나 치과에 갔던 경험을 말해 주세요. 왜 갔으며 도착해서 무엇을 했고 어떤 일이 있었나요? 자세히 설명해 주세요."
      },
      {
        "id": "doctors-q4",
        "number": "4",
        "title": "An Unforgettable Experience at a Doctor's or Dentist's Office",
        "type": "memorable",
        "source": "provided",
        "en": "Many kinds of unexpected things can happen when you are at a doctor's or dentist's office. Tell me about one experience you had that was unforgettable. Start by telling me when this happened, where you were, and who you were with. Then, tell me about all the things that happened that made this experience so unforgettable.",
        "ko": "병원이나 치과에서는 여러 예상 밖의 일이 일어날 수 있습니다. 잊을 수 없는 경험 한 가지를 말해 주세요. 언제, 어디서, 누구와 있었는지 먼저 말하고, 그 경험을 잊을 수 없게 만든 일들을 모두 설명해 주세요."
      }
    ]
  },
  {
    "id": "appointments",
    "category": "surprise",
    "ko": "약속·예약",
    "en": "Appointments",
    "emoji": "",
    "questions": [
      {
        "id": "appointments-q1",
        "number": "1",
        "title": "Places You Go for Appointments",
        "type": "description",
        "source": "provided",
        "en": "People often have appointments for different things. Tell me about the kinds of places you go for different appointments.",
        "ko": "사람들은 여러 이유로 약속을 잡습니다. 다양한 약속을 위해 어떤 종류의 장소에 가는지 말해 주세요."
      },
      {
        "id": "appointments-q2",
        "number": "2",
        "title": "Making Appointments",
        "type": "routine",
        "source": "provided",
        "en": "What kinds of things do you do when you make appointments? Tell me exactly what you do when you make these appointments.",
        "ko": "약속이나 예약을 잡을 때 무엇을 하나요? 정확히 어떤 과정을 거치는지 말해 주세요."
      },
      {
        "id": "appointments-q3",
        "number": "3",
        "title": "An Appointment You Made as a Child",
        "type": "experience",
        "source": "provided",
        "en": "Talk about an appointment you made as a child. What was the appointment for? Was it for a doctor, a dentist, or a new school? What did you do, and what happened when you got to your appointment?",
        "ko": "어릴 때 잡았던 약속이나 예약을 말해 주세요. 어떤 목적이었나요? 병원, 치과, 새 학교 때문이었나요? 무엇을 했고 약속 장소에 도착했을 때 어떤 일이 있었나요?"
      },
      {
        "id": "appointments-q4",
        "number": "4",
        "title": "A Memorable Incident Related to an Appointment",
        "type": "memorable",
        "source": "provided",
        "en": "Unexpected things can happen when you make an appointment. Talk about a memorable incident regarding an appointment. What exactly happened, and how did you deal with the situation?",
        "ko": "약속이나 예약을 잡다 보면 예상 밖의 일이 생길 수 있습니다. 약속과 관련해 기억에 남는 사건을 말해 주세요. 정확히 무슨 일이 있었고 어떻게 대처했나요?"
      }
    ]
  },
  {
    "id": "hair-salons",
    "category": "surprise",
    "ko": "미용실",
    "en": "Hair Salons",
    "emoji": "",
    "questions": [
      {
        "id": "hair-salons-q1",
        "number": "1",
        "title": "Your Hair Salon",
        "type": "description",
        "source": "provided",
        "en": "Where do you typically have your hair cut or styled? Tell me all about the place where you usually get your haircut.",
        "ko": "보통 어디에서 머리를 자르거나 손질하나요? 평소 머리를 자르는 곳을 자세히 말해 주세요."
      },
      {
        "id": "hair-salons-q2",
        "number": "2",
        "title": "Hair Salon Routine & Activities",
        "type": "routine",
        "source": "provided",
        "en": "Tell me what typically goes on when you visit a hair salon. What do you usually do there? What do you do from the moment you walk in until you walk out?",
        "ko": "미용실에 가면 보통 어떤 일이 있나요? 그곳에서 주로 무엇을 하나요? 들어가는 순간부터 나올 때까지의 과정을 말해 주세요."
      },
      {
        "id": "hair-salons-q3",
        "number": "3",
        "title": "A Memorable Haircut",
        "type": "memorable",
        "source": "provided",
        "en": "Tell me about a memorable haircut you have ever gotten. Why was it so memorable? Give me all the details about what happened.",
        "ko": "지금까지 했던 머리 중 기억에 남는 경험을 말해 주세요. 왜 기억에 남나요? 무슨 일이 있었는지 자세히 설명해 주세요."
      },
      {
        "id": "hair-salons-q4",
        "number": "4",
        "title": "Your Hairstylist",
        "type": "description",
        "source": "provided",
        "en": "Tell me about your hairstylist. How did you first meet your hairstylist? Did someone recommend him or her to you? What is he or she like? Describe him or her in as much detail as you can.",
        "ko": "담당 미용사에 대해 말해 주세요. 처음 어떻게 만났나요? 누군가 추천해 줬나요? 어떤 사람인지 최대한 자세히 설명해 주세요."
      }
    ]
  }
];

export const surpriseQuestionCount = surpriseTopics.reduce((sum, topic) => sum + topic.questions.length, 0);
