/**
 * ko — 원본 한국어. 코드에서 뽑아낸 문자열을 **무손실**로 옮긴 것이다.
 *
 * nick.name.* / bot.name.* 64개는 원래 코드의 8x8 조합(NICK_A x NICK_B,
 * BOT_NAME_A x BOT_NAME_B)을 idx = i*8 + j 순서로 펼친 것이라,
 * 기존 사용자의 닉네임이 한 글자도 바뀌지 않는다(마이그레이션 불필요).
 */
import type { Messages } from '../types';

const ko: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  'game.title': '땅따먹기',

  'splash.subtitle': '{cols} × {rows}, {players}인, {seconds}초',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': '경기 시간과 난이도를 고르세요',

  // 오늘의 대결(출석) — ★2026-08-22 신설. 승패 무관, 완료(phase='over' 도달)가 기준.
  'menu.dailyClash.title': '오늘의 대결',
  'menu.dailyClash.status.pending': '오늘 플레이하면 연속 {streak}일째 · 완료 시 코인 +{coins}',
  'menu.dailyClash.status.done': '오늘 완료! 연속 {streak}일째 · 내일 또 만나요',
  'menu.dailyClash.play': '오늘의 대결 시작',
  'menu.dailyClash.doneButton': '완료',

  'menu.mode': '경기 시간',

  'menu.mode.60': '1분',

  'menu.mode.180': '3분',

  'menu.mode.300': '5분',

  'menu.mode.desc': '{cols} × {rows} 맵 · {players}인',

  'menu.difficulty': '난이도',

  'menu.difficulty.auto': '자동',

  'menu.difficulty.easy': '쉬움',

  'menu.difficulty.normal': '보통',

  'menu.difficulty.hard': '어려움',

  'menu.difficulty.elite': '최고',

  'menu.difficulty.auto.hint': '최근 성적에 맞춰 난이도가 자동으로 조정돼요.', // ★2026-08-22 T5: "봇" 표기 금지 — 카피 정리(검증 게이트 항목)

  'menu.best': '이 모드 최고',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': '시작하기',


  'hud.rank.unit': '위',
  'hud.time.unit': '초',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': '남음',
  'hud.rate': '+{rate}/초',
  'hud.bounce': '튕기기',
  'hud.bounce.aria': '3번 튕기기',

  'modal.pause.title': '일시정지',
  'modal.pause.body': '게임이 멈춰 있어요. 뒤로가기를 한 번 더 누르면 종료 확인 창이 열립니다.',
  'modal.pause.resume': '계속하기',
  'modal.revive.title': '영토를 전부 잃었어요',
  'modal.revive.body': '빈 땅에 {size} 로 복귀할 수 있어요. 세션당 {limit}만 가능합니다.',
  'modal.revive.limit': '1회',
  'modal.revive.decline': '결과 보기',
  'modal.revive.accept': '부활하기',
  'modal.revive.body.free': '빈 땅에 {size} 로 복귀할 수 있어요. 무료 부활은 {limit}예요.',
  'modal.revive.body.ad': '광고를 보면 한 번 더 복귀할 수 있어요.',
  'modal.revive.accept.ad': '광고 보고 부활하기',
  'modal.revive.loading': '광고 불러오는 중…',
  'modal.exit.title': '게임을 종료할까요?',
  'modal.exit.body': '진행 중인 게임은 저장되지 않아요.',
  'modal.exit.confirm': '나가기',
  'modal.exit.cancel': '계속하기',

  'result.newBest': '최고 기록 갱신!',
  'result.cells': '최종 영토',
  'result.income': '지가 수입',
  'result.kills': '처치',
  'result.maxTrail': '최장 꼬리',
  'result.coins': '획득 코인',
  'result.xp': '경험치',
  'result.restart': '다시하기',

  'result.changeMode': '모드 변경',

  'result.mode': '{mode} · {players}인',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count}칸',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': '통산 기록',
  'career.plays': '플레이',
  'career.wins': '1위',
  'career.kills': '누적 처치',
  'career.xp': '누적 경험치',
  'career.value.plays': '{count}판',
  'career.value.wins': '{count}회',
  'career.value.kills': '{count}회',
  'career.value.xp': '{count}',

  'fx.kill': '처치!',

  'tier.normal': '일반',
  'tier.commercial': '상업',
  'tier.special': '특수',
  'tier.label': '{name}({value}/초)',

  'unit.you': '나',
  'unit.ghost': '어제의 {nick}님',

  'error.fatal.title': '실행 오류',
  'error.noCanvas': '캔버스 엘리먼트(#stage)를 찾을 수 없습니다.',
  'error.sdkInit': 'SDK 초기화에 실패했습니다.',
  'error.gameStart': '게임 시작에 실패했습니다.',

  'settings.language': '언어',
  'settings.privacyLink': '개인정보처리방침',
  'settings.sound': '효과음',
  'settings.sound.on': '켜짐',
  'settings.sound.off': '꺼짐',

  // ── 토스 푸시 알림(오늘의 대결) — ★2026-09-10 신설. 토스 안에서만 그려진다(src/ui/pushOptIn.ts).
  'push.row.label': '오늘의 대결 알림',
  'push.row.get': '받기',
  'push.row.busy': '확인 중',
  'push.row.on': '켜짐',
  'push.row.retry': '다시 켜기',
  'push.row.hint': '매일 저녁 7시에 오늘의 대결 맵이 열리면 알려 드려요. 끄기는 토스 앱의 알림 설정에서 할 수 있어요.',
  'push.row.error': '알림 설정을 불러오지 못했어요. 토스 앱을 최신 버전으로 업데이트한 뒤 다시 눌러 주세요.',
  'push.nudge.title': '오늘의 대결 알림 받기',
  'push.nudge.sub': '매일 저녁 7시, 새 맵이 열리면 알려 드려요',
  'push.nudge.cta': '받기',
  'push.nudge.busy': '확인 중',
  'push.nudge.close': '알림 안내 닫기',

  // ── 「머니 리그」 교차추천 카드(결과 화면 하루 1회) — ★2026-09-10 신설(src/ui/crossPromo.ts).
  'promo.ml.label': '추천',
  'promo.ml.title': '머니 리그',
  'promo.ml.sub': '1만 명 봇 리그에서 가상 투자',
  'promo.ml.open': '열기',
  'promo.ml.close': '추천 닫기',
  'promo.ml.fail': '지금은 열 수 없어요. 토스 앱에서 머니 리그를 검색해 주세요.',

  'nick.name.0': '빠른소나기',
  'nick.name.1': '빠른민들레',
  'nick.name.2': '빠른까치',
  'nick.name.3': '빠른노을',
  'nick.name.4': '빠른연필',
  'nick.name.5': '빠른두루미',
  'nick.name.6': '빠른바람개비',
  'nick.name.7': '빠른단추',
  'nick.name.8': '고요한소나기',
  'nick.name.9': '고요한민들레',
  'nick.name.10': '고요한까치',
  'nick.name.11': '고요한노을',
  'nick.name.12': '고요한연필',
  'nick.name.13': '고요한두루미',
  'nick.name.14': '고요한바람개비',
  'nick.name.15': '고요한단추',
  'nick.name.16': '푸른소나기',
  'nick.name.17': '푸른민들레',
  'nick.name.18': '푸른까치',
  'nick.name.19': '푸른노을',
  'nick.name.20': '푸른연필',
  'nick.name.21': '푸른두루미',
  'nick.name.22': '푸른바람개비',
  'nick.name.23': '푸른단추',
  'nick.name.24': '작은소나기',
  'nick.name.25': '작은민들레',
  'nick.name.26': '작은까치',
  'nick.name.27': '작은노을',
  'nick.name.28': '작은연필',
  'nick.name.29': '작은두루미',
  'nick.name.30': '작은바람개비',
  'nick.name.31': '작은단추',
  'nick.name.32': '깊은소나기',
  'nick.name.33': '깊은민들레',
  'nick.name.34': '깊은까치',
  'nick.name.35': '깊은노을',
  'nick.name.36': '깊은연필',
  'nick.name.37': '깊은두루미',
  'nick.name.38': '깊은바람개비',
  'nick.name.39': '깊은단추',
  'nick.name.40': '맑은소나기',
  'nick.name.41': '맑은민들레',
  'nick.name.42': '맑은까치',
  'nick.name.43': '맑은노을',
  'nick.name.44': '맑은연필',
  'nick.name.45': '맑은두루미',
  'nick.name.46': '맑은바람개비',
  'nick.name.47': '맑은단추',
  'nick.name.48': '둥근소나기',
  'nick.name.49': '둥근민들레',
  'nick.name.50': '둥근까치',
  'nick.name.51': '둥근노을',
  'nick.name.52': '둥근연필',
  'nick.name.53': '둥근두루미',
  'nick.name.54': '둥근바람개비',
  'nick.name.55': '둥근단추',
  'nick.name.56': '단단한소나기',
  'nick.name.57': '단단한민들레',
  'nick.name.58': '단단한까치',
  'nick.name.59': '단단한노을',
  'nick.name.60': '단단한연필',
  'nick.name.61': '단단한두루미',
  'nick.name.62': '단단한바람개비',
  'nick.name.63': '단단한단추',

  'bot.name.0': '성실한부동산',
  'bot.name.1': '성실한지주',
  'bot.name.2': '성실한측량사',
  'bot.name.3': '성실한개척자',
  'bot.name.4': '성실한건축가',
  'bot.name.5': '성실한투자자',
  'bot.name.6': '성실한중개인',
  'bot.name.7': '성실한토지왕',
  'bot.name.8': '냉철한부동산',
  'bot.name.9': '냉철한지주',
  'bot.name.10': '냉철한측량사',
  'bot.name.11': '냉철한개척자',
  'bot.name.12': '냉철한건축가',
  'bot.name.13': '냉철한투자자',
  'bot.name.14': '냉철한중개인',
  'bot.name.15': '냉철한토지왕',
  'bot.name.16': '느긋한부동산',
  'bot.name.17': '느긋한지주',
  'bot.name.18': '느긋한측량사',
  'bot.name.19': '느긋한개척자',
  'bot.name.20': '느긋한건축가',
  'bot.name.21': '느긋한투자자',
  'bot.name.22': '느긋한중개인',
  'bot.name.23': '느긋한토지왕',
  'bot.name.24': '집요한부동산',
  'bot.name.25': '집요한지주',
  'bot.name.26': '집요한측량사',
  'bot.name.27': '집요한개척자',
  'bot.name.28': '집요한건축가',
  'bot.name.29': '집요한투자자',
  'bot.name.30': '집요한중개인',
  'bot.name.31': '집요한토지왕',
  'bot.name.32': '조용한부동산',
  'bot.name.33': '조용한지주',
  'bot.name.34': '조용한측량사',
  'bot.name.35': '조용한개척자',
  'bot.name.36': '조용한건축가',
  'bot.name.37': '조용한투자자',
  'bot.name.38': '조용한중개인',
  'bot.name.39': '조용한토지왕',
  'bot.name.40': '대담한부동산',
  'bot.name.41': '대담한지주',
  'bot.name.42': '대담한측량사',
  'bot.name.43': '대담한개척자',
  'bot.name.44': '대담한건축가',
  'bot.name.45': '대담한투자자',
  'bot.name.46': '대담한중개인',
  'bot.name.47': '대담한토지왕',
  'bot.name.48': '치밀한부동산',
  'bot.name.49': '치밀한지주',
  'bot.name.50': '치밀한측량사',
  'bot.name.51': '치밀한개척자',
  'bot.name.52': '치밀한건축가',
  'bot.name.53': '치밀한투자자',
  'bot.name.54': '치밀한중개인',
  'bot.name.55': '치밀한토지왕',
  'bot.name.56': '눈치빠른부동산',
  'bot.name.57': '눈치빠른지주',
  'bot.name.58': '눈치빠른측량사',
  'bot.name.59': '눈치빠른개척자',
  'bot.name.60': '눈치빠른건축가',
  'bot.name.61': '눈치빠른투자자',
  'bot.name.62': '눈치빠른중개인',
  'bot.name.63': '눈치빠른토지왕',
};

export default ko;
