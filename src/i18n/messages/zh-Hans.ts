/**
 * zh-Hans — 简体中文。
 *
 * 표기 방침
 *  - 게임 UI 관용 표기. 라벨·버튼은 2~4자로 압축.
 *  - 영토 = 领地, 꼬리 = 轨迹, 처치 = 淘汰, 부활 = 复活, 튕기기 = 弹射 로 고정.
 *  - ⚠ 처치는 「击杀」(=kill) 로 되돌리지 마라. en=Takedowns / ko=처치 / ja=撃破 는 전부
 *    비치사 표현이고, IARC 연령등급 신고서에 "사망·부상 묘사 없음"으로 답한다.
 *    중국어만 「击杀」이면 우리 UI가 우리 신고 내용과 모순된다.
 *  - HUD 칩(rank/time)은 1글자(名 / 秒)로 유지한다.
 *  - 괄호는 전각(（）)을 쓴다.
 */
import type { Messages } from '../types';

const zh_Hans: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  // ⛔ 상표 확인 전 사용 금지 — 등록·표기 전 President 승인 필요.
  //    중국어 제목 후보였던 「圈地大作战」 는 **중국 시장에 이미 출시된 타이틀과
  //    충돌한다는 보고**가 있다(Paper.io 계열 현지화명). 상표 판단은 법률 사안이라
  //    기술팀이 대체 중국어명을 고르지 않는다. 확인이 끝날 때까지 우리가 소유한
  //    브랜드명을 그대로 쓴다(안전하고 되돌리기 쉬운 선택).
  //    ★ 이 주석을 읽고 위 이름을 "복구"하지 마라. 스토어 중국어 명칭을 정할 때도
  //      President 승인 없이는 쓰지 마라.
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players}人, {seconds}秒',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': '选择对局时长和难度',

  // 今日对决(签到) — ★2026-08-22 新增。胜负无关,以完成(到达 phase='over')为准。
  'menu.dailyClash.title': '今日对决',
  'menu.dailyClash.status.pending': '今天完成可连续{streak}天 ・ 完成得金币+{coins}',
  'menu.dailyClash.status.done': '今天已完成!连续{streak}天 ・ 明天再来',
  'menu.dailyClash.play': '开始今日对决',
  'menu.dailyClash.doneButton': '已完成',

  'menu.mode': '对局时长',

  'menu.mode.60': '1分钟',

  'menu.mode.180': '3分钟',

  'menu.mode.300': '5分钟',

  'menu.mode.desc': '{cols} × {rows} 地图 · {players} 名玩家',

  'menu.difficulty': '难度',

  'menu.difficulty.auto': '自动',

  'menu.difficulty.easy': '简单',

  'menu.difficulty.normal': '普通',

  'menu.difficulty.hard': '困难',

  'menu.difficulty.elite': '极限',

  'menu.difficulty.auto.hint': '难度会根据你最近的成绩自动调整。', // ★2026-08-22 T5: 去掉"机器人"表述

  'menu.best': '本模式最高分',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': '开始',


  'hud.rank.unit': '名',
  'hud.time.unit': '秒',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': '剩余',
  'hud.rate': '+{rate}/秒',
  'hud.bounce': '弹射',
  // 1회 발동 = 3연속 弹射(sim.ts b.shot>=3, poly=원점+착지 3점). "3회분 충전" 아님.
  'hud.bounce.aria': '三连弹射',

  'modal.pause.title': '已暂停',
  'modal.pause.body': '游戏已暂停。再按一次返回键，会弹出退出确认。',
  'modal.pause.resume': '继续游戏',
  'modal.revive.title': '领地全部失守',
  'modal.revive.body': '可以在空地上以{size}的范围复活。每局仅限{limit}。',
  'modal.revive.limit': '1次',
  'modal.revive.decline': '查看结果',
  'modal.revive.accept': '复活',
  'modal.revive.body.free': '可以在空地上以{size}的范围复活。免费复活每局{limit}。',
  'modal.revive.body.ad': '观看广告即可再复活一次。',
  'modal.revive.accept.ad': '看广告复活',
  'modal.revive.loading': '正在加载广告…',
  'modal.exit.title': '要退出游戏吗？',
  'modal.exit.body': '进行中的对局不会被保存。',
  'modal.exit.confirm': '退出',
  'modal.exit.cancel': '继续玩',

  'result.newBest': '新纪录！',
  'result.cells': '最终领地',
  'result.income': '土地收入',
  'result.kills': '淘汰数',
  'result.maxTrail': '最长轨迹',
  'result.coins': '获得金币',
  'result.xp': '经验值',
  'result.restart': '再来一局',

  'result.changeMode': '更改模式',

  'result.mode': '{mode} · {players} 名玩家',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count}格',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': '生涯记录',
  'career.plays': '游玩局数',
  'career.wins': '第一名',
  'career.kills': '累计淘汰数',
  'career.xp': '累计经验值',
  'career.value.plays': '{count}局',
  'career.value.wins': '{count}次',
  'career.value.kills': '{count}次',
  'career.value.xp': '{count}',

  'fx.kill': '淘汰！',

  'tier.normal': '普通',
  'tier.commercial': '商业',
  'tier.special': '特殊',
  'tier.label': '{name}（{value}/秒）',

  'unit.you': '我',
  'unit.ghost': '昨天的{nick}',

  'error.fatal.title': '出错了',
  'error.noCanvas': '无法启动游戏（未找到 canvas 元素）。',
  'error.sdkInit': 'SDK 初始化失败。',
  'error.gameStart': '游戏启动失败。',

  'settings.language': '语言',
  'settings.privacyLink': '隐私政策',
  'settings.sound': '音效',
  'settings.sound.on': '开',
  'settings.sound.off': '关',

  // ── Toss 推送提醒(今日对决) — ★2026-09-10 新增。仅在 Toss 内显示(src/ui/pushOptIn.ts)。
  'push.row.label': '今日对决提醒',
  'push.row.get': '开启',
  'push.row.busy': '确认中',
  'push.row.on': '已开启',
  'push.row.retry': '重新开启',
  'push.row.hint': '每天晚上7点(KST)今日对决的新地图开放时提醒你。如需关闭，请在Toss应用的通知设置中操作。',
  'push.row.error': '无法打开通知设置。请将Toss应用更新到最新版本后再点一次。',
  'push.nudge.title': '接收今日对决提醒',
  'push.nudge.sub': '每天晚上7点(KST)，新地图开放时提醒你',
  'push.nudge.cta': '开启',
  'push.nudge.busy': '确认中',
  'push.nudge.close': '关闭提醒提示',

  // ── 「Money League」推荐卡片(结果画面·每天1次) — ★2026-09-10 新增(src/ui/crossPromo.ts)。
  'promo.ml.label': '推荐',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': '在一万个机器人的联赛中进行模拟投资',
  'promo.ml.open': '打开',
  'promo.ml.close': '关闭推荐',
  'promo.ml.fail': '现在无法打开。请在Toss应用中搜索Money League。',

  'nick.name.0': '轻快阵雨',
  'nick.name.1': '轻快蒲公英',
  'nick.name.2': '轻快喜鹊',
  'nick.name.3': '轻快晚霞',
  'nick.name.4': '轻快铅笔',
  'nick.name.5': '轻快仙鹤',
  'nick.name.6': '轻快风车',
  'nick.name.7': '轻快纽扣',
  'nick.name.8': '安静阵雨',
  'nick.name.9': '安静蒲公英',
  'nick.name.10': '安静喜鹊',
  'nick.name.11': '安静晚霞',
  'nick.name.12': '安静铅笔',
  'nick.name.13': '安静仙鹤',
  'nick.name.14': '安静风车',
  'nick.name.15': '安静纽扣',
  'nick.name.16': '蔚蓝阵雨',
  'nick.name.17': '蔚蓝蒲公英',
  'nick.name.18': '蔚蓝喜鹊',
  'nick.name.19': '蔚蓝晚霞',
  'nick.name.20': '蔚蓝铅笔',
  'nick.name.21': '蔚蓝仙鹤',
  'nick.name.22': '蔚蓝风车',
  'nick.name.23': '蔚蓝纽扣',
  'nick.name.24': '小小阵雨',
  'nick.name.25': '小小蒲公英',
  'nick.name.26': '小小喜鹊',
  'nick.name.27': '小小晚霞',
  'nick.name.28': '小小铅笔',
  'nick.name.29': '小小仙鹤',
  'nick.name.30': '小小风车',
  'nick.name.31': '小小纽扣',
  'nick.name.32': '深邃阵雨',
  'nick.name.33': '深邃蒲公英',
  'nick.name.34': '深邃喜鹊',
  'nick.name.35': '深邃晚霞',
  'nick.name.36': '深邃铅笔',
  'nick.name.37': '深邃仙鹤',
  'nick.name.38': '深邃风车',
  'nick.name.39': '深邃纽扣',
  'nick.name.40': '清澈阵雨',
  'nick.name.41': '清澈蒲公英',
  'nick.name.42': '清澈喜鹊',
  'nick.name.43': '清澈晚霞',
  'nick.name.44': '清澈铅笔',
  'nick.name.45': '清澈仙鹤',
  'nick.name.46': '清澈风车',
  'nick.name.47': '清澈纽扣',
  'nick.name.48': '圆圆阵雨',
  'nick.name.49': '圆圆蒲公英',
  'nick.name.50': '圆圆喜鹊',
  'nick.name.51': '圆圆晚霞',
  'nick.name.52': '圆圆铅笔',
  'nick.name.53': '圆圆仙鹤',
  'nick.name.54': '圆圆风车',
  'nick.name.55': '圆圆纽扣',
  'nick.name.56': '结实阵雨',
  'nick.name.57': '结实蒲公英',
  'nick.name.58': '结实喜鹊',
  'nick.name.59': '结实晚霞',
  'nick.name.60': '结实铅笔',
  'nick.name.61': '结实仙鹤',
  'nick.name.62': '结实风车',
  'nick.name.63': '结实纽扣',

  'bot.name.0': '勤恳地产商',
  'bot.name.1': '勤恳地主',
  'bot.name.2': '勤恳测量员',
  'bot.name.3': '勤恳开拓者',
  'bot.name.4': '勤恳建筑师',
  'bot.name.5': '勤恳投资客',
  'bot.name.6': '勤恳经纪人',
  'bot.name.7': '勤恳地王',
  'bot.name.8': '冷静地产商',
  'bot.name.9': '冷静地主',
  'bot.name.10': '冷静测量员',
  'bot.name.11': '冷静开拓者',
  'bot.name.12': '冷静建筑师',
  'bot.name.13': '冷静投资客',
  'bot.name.14': '冷静经纪人',
  'bot.name.15': '冷静地王',
  'bot.name.16': '悠闲地产商',
  'bot.name.17': '悠闲地主',
  'bot.name.18': '悠闲测量员',
  'bot.name.19': '悠闲开拓者',
  'bot.name.20': '悠闲建筑师',
  'bot.name.21': '悠闲投资客',
  'bot.name.22': '悠闲经纪人',
  'bot.name.23': '悠闲地王',
  'bot.name.24': '执着地产商',
  'bot.name.25': '执着地主',
  'bot.name.26': '执着测量员',
  'bot.name.27': '执着开拓者',
  'bot.name.28': '执着建筑师',
  'bot.name.29': '执着投资客',
  'bot.name.30': '执着经纪人',
  'bot.name.31': '执着地王',
  'bot.name.32': '沉默地产商',
  'bot.name.33': '沉默地主',
  'bot.name.34': '沉默测量员',
  'bot.name.35': '沉默开拓者',
  'bot.name.36': '沉默建筑师',
  'bot.name.37': '沉默投资客',
  'bot.name.38': '沉默经纪人',
  'bot.name.39': '沉默地王',
  'bot.name.40': '大胆地产商',
  'bot.name.41': '大胆地主',
  'bot.name.42': '大胆测量员',
  'bot.name.43': '大胆开拓者',
  'bot.name.44': '大胆建筑师',
  'bot.name.45': '大胆投资客',
  'bot.name.46': '大胆经纪人',
  'bot.name.47': '大胆地王',
  'bot.name.48': '缜密地产商',
  'bot.name.49': '缜密地主',
  'bot.name.50': '缜密测量员',
  'bot.name.51': '缜密开拓者',
  'bot.name.52': '缜密建筑师',
  'bot.name.53': '缜密投资客',
  'bot.name.54': '缜密经纪人',
  'bot.name.55': '缜密地王',
  'bot.name.56': '精明地产商',
  'bot.name.57': '精明地主',
  'bot.name.58': '精明测量员',
  'bot.name.59': '精明开拓者',
  'bot.name.60': '精明建筑师',
  'bot.name.61': '精明投资客',
  'bot.name.62': '精明经纪人',
  'bot.name.63': '精明地王',
};

export default zh_Hans;
