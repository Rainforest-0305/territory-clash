/**
 * ja — 日本語。
 *
 * 표기 방침
 *  - 문장은 敬体(です・ます)로 통일. 버튼·라벨은 짧은 명사/동사구.
 *  - 영토 = 陣地, 꼬리 = ライン, 처치 = 撃破, 부활 = 復活, 튕기기 = はじく 로 고정.
 *  - HUD 칩(rank/time)은 1글자(位 / 秒)로 유지한다.
 *  - nick.name.* 는 가나 표기가 자연스러운 단어는 가나로 두는 일본어 정서법을 따랐다.
 */
import type { Messages } from '../types';

const ja: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  // ⛔ 상표 미확인 — 사용 금지.
  //    보류된 현지화 제목 후보(정식 상표조사 끝나기 전에는 값으로 넣지 마라):
  //      ja      「陣取りクラッシュ」  — 완전일치 검색결과 0건. 품질 문제로 뺀 게 아니다.
  //      zh-Hans 「圈地大作战」        — CN 시장에 동명 출시작 다수(무관한 퍼블리셔 5곳 이상).
  //    ko 만 현지어를 쓴다(땅따먹기 = 이미 등록된 Toss 콘솔 명칭, 신규 작명이 아님).
  //    나머지 8개 로케일은 영문 브랜드로 통일한다 — 우리는 정식 상표 클리어런스를
  //    수행할 능력이 없고, 8개 시장에 새 제목을 만들면 확인 불가능한 리스크가 8배가 된다.
  //    ★ 클리어런스가 끝나면 위 후보가 출발점이다. 그 전에는 President 승인 없이 금지.
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players}人, {seconds}秒',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': '試合時間と難易度を選んでください',

  // 今日の対決(出席) — ★2026-08-22 新設。勝敗は無関係、完了(phase='over' 到達)が基準。
  'menu.dailyClash.title': '今日の対決',
  'menu.dailyClash.status.pending': '今日プレイすると{streak}日連続 ・ 完了でコイン+{coins}',
  'menu.dailyClash.status.done': '本日分クリア!{streak}日連続 ・ また明日',
  'menu.dailyClash.play': '今日の対決へ',
  'menu.dailyClash.doneButton': '完了',

  'menu.mode': '試合時間',

  'menu.mode.60': '1分',

  'menu.mode.180': '3分',

  'menu.mode.300': '5分',

  'menu.mode.desc': '{cols} × {rows} マップ · {players}人',

  'menu.difficulty': '難易度',

  'menu.difficulty.auto': '自動',

  'menu.difficulty.easy': 'やさしい',

  'menu.difficulty.normal': 'ふつう',

  'menu.difficulty.hard': 'むずかしい',

  'menu.difficulty.elite': '最高',

  'menu.difficulty.auto.hint': '最近の成績に合わせて難易度が自動調整されます。', // ★2026-08-22 T5: 「ボット」表記を削除

  'menu.best': 'このモードの最高記録',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': 'はじめる',


  'hud.rank.unit': '位',
  'hud.time.unit': '秒',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': '残り',
  'hud.rate': '+{rate}/秒',
  'hud.bounce': 'はじく',
  // ⚠ 「はじき」(명사)는 일본어에서 권총을 뜻하는 은어다(はじき鉄砲 유래, 동사 ハジく=쏘다).
  //    동사형 「はじく」(=弾く, 튕기다)는 일상어라 문제없다. 명사화하지 마라.
  //    이건 aria-label 이라 스크린리더가 소리내어 읽는다 — 오독 노출이 가장 큰 자리다.
  //    한자 「弾く」로도 쓰지 마라. 弾く 는 ひく(악기 연주)로도 읽혀 TTS 가 오독한다.
  //    히라가나 「はじく」 고정.
  //    의미: 1회 발동 = 3연속 튕김(sim.ts b.shot>=3, poly=원점+착지 3점). "3회분 충전" 아님.
  'hud.bounce.aria': '3回連続ではじく',

  'modal.pause.title': '一時停止',
  'modal.pause.body': 'ゲームは一時停止中です。戻るボタンをもう一度押すと、終了の確認が表示されます。',
  'modal.pause.resume': '再開する',
  'modal.revive.title': '陣地をすべて失いました',
  'modal.revive.body': '空き地に{size}の広さで復活できます。1ゲームにつき{limit}までです。',
  'modal.revive.limit': '1回',
  'modal.revive.decline': '結果を見る',
  'modal.revive.accept': '復活する',
  'modal.revive.body.free': '空き地に{size}の広さで復活できます。無料の復活は1ゲームにつき{limit}です。',
  'modal.revive.body.ad': '広告を見ると、もう一度復活できます。',
  'modal.revive.accept.ad': '広告を見て復活',
  'modal.revive.loading': '広告を読み込み中…',
  'modal.exit.title': 'ゲームを終了しますか？',
  'modal.exit.body': 'プレイ中のゲームは保存されません。',
  'modal.exit.confirm': '終了する',
  'modal.exit.cancel': '続ける',

  'result.newBest': '自己ベスト更新！',
  'result.cells': '最終陣地',
  'result.income': '土地収入',
  'result.kills': '撃破数',
  'result.maxTrail': '最長ライン',
  'result.coins': '獲得コイン',
  'result.xp': '経験値',
  'result.restart': 'もう一度プレイ',

  'result.changeMode': 'モード変更',

  'result.mode': '{mode} · {players}人',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count}マス',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': '通算記録',
  'career.plays': 'プレイ回数',
  'career.wins': '1位',
  'career.kills': '累計撃破数',
  'career.xp': '累計経験値',
  'career.value.plays': '{count}回',
  'career.value.wins': '{count}回',
  'career.value.kills': '{count}回',
  'career.value.xp': '{count}',

  'fx.kill': '撃破！',

  'tier.normal': '通常',
  'tier.commercial': '商業',
  'tier.special': '特殊',
  'tier.label': '{name}（{value}/秒）',

  'unit.you': 'あなた',
  'unit.ghost': '昨日の{nick}',

  'error.fatal.title': 'エラーが発生しました',
  'error.noCanvas': 'ゲームを開始できませんでした（canvas 要素が見つかりません）。',
  'error.sdkInit': 'SDK の初期化に失敗しました。',
  'error.gameStart': 'ゲームの開始に失敗しました。',

  'settings.language': '言語',
  'settings.privacyLink': 'プライバシーポリシー',
  'settings.sound': '効果音',
  'settings.sound.on': 'オン',
  'settings.sound.off': 'オフ',

  // ── Toss プッシュ通知(今日の対決) — ★2026-09-10 新設。Toss 内でのみ表示(src/ui/pushOptIn.ts)。
  'push.row.label': '今日の対決の通知',
  'push.row.get': '受け取る',
  'push.row.busy': '確認中',
  'push.row.on': 'オン',
  'push.row.retry': 'もう一度オンにする',
  'push.row.hint': '毎日夜7時(KST)に今日の対決の新しいマップが開いたらお知らせします。オフにするにはTossアプリの通知設定をご利用ください。',
  'push.row.error': '通知設定を開けませんでした。Tossアプリを最新版に更新してからもう一度押してください。',
  'push.nudge.title': '今日の対決の通知を受け取る',
  'push.nudge.sub': '毎日夜7時(KST)、新しいマップが開いたらお知らせします',
  'push.nudge.cta': '受け取る',
  'push.nudge.busy': '確認中',
  'push.nudge.close': '通知の案内を閉じる',

  // ── 「Money League」おすすめカード(結果画面・1日1回) — ★2026-09-10 新設(src/ui/crossPromo.ts)。
  'promo.ml.label': 'おすすめ',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': '1万人のボットリーグでバーチャル投資',
  'promo.ml.open': '開く',
  'promo.ml.close': 'おすすめを閉じる',
  'promo.ml.fail': '今は開けません。TossアプリでMoney Leagueを検索してください。',

  'nick.name.0': '速い夕立',
  'nick.name.1': '速いたんぽぽ',
  'nick.name.2': '速いかささぎ',
  'nick.name.3': '速い夕焼け',
  'nick.name.4': '速いえんぴつ',
  'nick.name.5': '速い鶴',
  'nick.name.6': '速いかざぐるま',
  'nick.name.7': '速いボタン',
  'nick.name.8': '静かな夕立',
  'nick.name.9': '静かなたんぽぽ',
  'nick.name.10': '静かなかささぎ',
  'nick.name.11': '静かな夕焼け',
  'nick.name.12': '静かなえんぴつ',
  'nick.name.13': '静かな鶴',
  'nick.name.14': '静かなかざぐるま',
  'nick.name.15': '静かなボタン',
  'nick.name.16': '青い夕立',
  'nick.name.17': '青いたんぽぽ',
  'nick.name.18': '青いかささぎ',
  'nick.name.19': '青い夕焼け',
  'nick.name.20': '青いえんぴつ',
  'nick.name.21': '青い鶴',
  'nick.name.22': '青いかざぐるま',
  'nick.name.23': '青いボタン',
  'nick.name.24': '小さな夕立',
  'nick.name.25': '小さなたんぽぽ',
  'nick.name.26': '小さなかささぎ',
  'nick.name.27': '小さな夕焼け',
  'nick.name.28': '小さなえんぴつ',
  'nick.name.29': '小さな鶴',
  'nick.name.30': '小さなかざぐるま',
  'nick.name.31': '小さなボタン',
  'nick.name.32': '深い夕立',
  'nick.name.33': '深いたんぽぽ',
  'nick.name.34': '深いかささぎ',
  'nick.name.35': '深い夕焼け',
  'nick.name.36': '深いえんぴつ',
  'nick.name.37': '深い鶴',
  'nick.name.38': '深いかざぐるま',
  'nick.name.39': '深いボタン',
  'nick.name.40': '澄んだ夕立',
  'nick.name.41': '澄んだたんぽぽ',
  'nick.name.42': '澄んだかささぎ',
  'nick.name.43': '澄んだ夕焼け',
  'nick.name.44': '澄んだえんぴつ',
  'nick.name.45': '澄んだ鶴',
  'nick.name.46': '澄んだかざぐるま',
  'nick.name.47': '澄んだボタン',
  'nick.name.48': '丸い夕立',
  'nick.name.49': '丸いたんぽぽ',
  'nick.name.50': '丸いかささぎ',
  'nick.name.51': '丸い夕焼け',
  'nick.name.52': '丸いえんぴつ',
  'nick.name.53': '丸い鶴',
  'nick.name.54': '丸いかざぐるま',
  'nick.name.55': '丸いボタン',
  'nick.name.56': '丈夫な夕立',
  'nick.name.57': '丈夫なたんぽぽ',
  'nick.name.58': '丈夫なかささぎ',
  'nick.name.59': '丈夫な夕焼け',
  'nick.name.60': '丈夫なえんぴつ',
  'nick.name.61': '丈夫な鶴',
  'nick.name.62': '丈夫なかざぐるま',
  'nick.name.63': '丈夫なボタン',

  // ⚠ 측량사 = 「測量技師」 로 고정. 「測量士」 로 "고치지" 마라.
  //    測量士 는 測量法상 국가자격 명칭(명칭독점)이다. 가상의 봇 이름이라 실무 리스크는
  //    낮다고 봤지만, IARC 연령등급 신고서에 서명하는 마당에 국가자격 명칭을 그대로
  //    쓸 이유가 없어서 일반 직종어로 바꿨다. 「測量技師」 는 자격명이 아니다.
  //    같은 이유로 「建築家」 는 그대로 둔다 — 이쪽은 법정 명칭이 아니라서 안전하다.
  //    (법정 명칭은 「建築士」. 이걸로 바꾸면 안 된다.)
  'bot.name.0': '勤勉な不動産屋',
  'bot.name.1': '勤勉な地主',
  'bot.name.2': '勤勉な測量技師',
  'bot.name.3': '勤勉な開拓者',
  'bot.name.4': '勤勉な建築家',
  'bot.name.5': '勤勉な投資家',
  'bot.name.6': '勤勉な仲介人',
  'bot.name.7': '勤勉な土地王',
  'bot.name.8': '冷徹な不動産屋',
  'bot.name.9': '冷徹な地主',
  'bot.name.10': '冷徹な測量技師',
  'bot.name.11': '冷徹な開拓者',
  'bot.name.12': '冷徹な建築家',
  'bot.name.13': '冷徹な投資家',
  'bot.name.14': '冷徹な仲介人',
  'bot.name.15': '冷徹な土地王',
  'bot.name.16': 'のんきな不動産屋',
  'bot.name.17': 'のんきな地主',
  'bot.name.18': 'のんきな測量技師',
  'bot.name.19': 'のんきな開拓者',
  'bot.name.20': 'のんきな建築家',
  'bot.name.21': 'のんきな投資家',
  'bot.name.22': 'のんきな仲介人',
  'bot.name.23': 'のんきな土地王',
  'bot.name.24': '執念深い不動産屋',
  'bot.name.25': '執念深い地主',
  'bot.name.26': '執念深い測量技師',
  'bot.name.27': '執念深い開拓者',
  'bot.name.28': '執念深い建築家',
  'bot.name.29': '執念深い投資家',
  'bot.name.30': '執念深い仲介人',
  'bot.name.31': '執念深い土地王',
  'bot.name.32': '物静かな不動産屋',
  'bot.name.33': '物静かな地主',
  'bot.name.34': '物静かな測量技師',
  'bot.name.35': '物静かな開拓者',
  'bot.name.36': '物静かな建築家',
  'bot.name.37': '物静かな投資家',
  'bot.name.38': '物静かな仲介人',
  'bot.name.39': '物静かな土地王',
  'bot.name.40': '大胆な不動産屋',
  'bot.name.41': '大胆な地主',
  'bot.name.42': '大胆な測量技師',
  'bot.name.43': '大胆な開拓者',
  'bot.name.44': '大胆な建築家',
  'bot.name.45': '大胆な投資家',
  'bot.name.46': '大胆な仲介人',
  'bot.name.47': '大胆な土地王',
  'bot.name.48': '緻密な不動産屋',
  'bot.name.49': '緻密な地主',
  'bot.name.50': '緻密な測量技師',
  'bot.name.51': '緻密な開拓者',
  'bot.name.52': '緻密な建築家',
  'bot.name.53': '緻密な投資家',
  'bot.name.54': '緻密な仲介人',
  'bot.name.55': '緻密な土地王',
  'bot.name.56': '目ざとい不動産屋',
  'bot.name.57': '目ざとい地主',
  'bot.name.58': '目ざとい測量技師',
  'bot.name.59': '目ざとい開拓者',
  'bot.name.60': '目ざとい建築家',
  'bot.name.61': '目ざとい投資家',
  'bot.name.62': '目ざとい仲介人',
  'bot.name.63': '目ざとい土地王',
};

export default ja;
