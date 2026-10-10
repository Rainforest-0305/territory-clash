/**
 * fr — français.
 *
 * 규칙
 *  - 키는 동결이다. 추가/삭제/이름변경 금지 (하면 컴파일 에러가 난다).
 *  - {likeThis} 자리표시자는 철자 그대로 유지한다(어순 재배치는 허용).
 *  - 값 안에 HTML 태그를 넣지 않는다.
 *  - 아포스트로피는 작은따옴표 문자열 안에서 \' 로 이스케이프한다.
 *
 * 번역 노트
 *  - 존칭(vouvoiement)으로 통일. 한국어 원문의 해요체 톤에 대응.
 *  - 프랑스어 조판 관례상 % 앞과 ? 앞에 공백을 둔다.
 *  - game.title 은 스토어 제품 아이덴티티라 영문 브랜드 그대로 둔다.
 *  - nick.name.*  : 8 형용사 × 8 자연 명사. 형용사는 원칙적으로 후치하되
 *                   'petit' 만 전치(프랑스어 BANGS 규칙) + 성수 일치.
 *                   Averse(f)·Pissenlit(m)·Pie(f)·Couchant(m)·
 *                   Crayon(m)·Cigogne(f)·Moulin à Vent(m)·Bouton(m)
 *  - bot.name.*   : 8 형용사 × 8 부동산 직함. 전부 후치 + 성수 일치.
 *                   Agence(f)·Rentier(m)·Géomètre(m)·Pionnier(m)·
 *                   Architecte(m)·Investisseur(m)·Courtier(m)·Roi des Terres(m)
 */
import type { Messages } from '../types';

const fr: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players} joueurs, {seconds} s',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': 'Choisis la durée et la difficulté',

  // Duel du jour (assiduité) — ★nouveau 2026-08-22. Victoire/défaite sans importance; seule la fin de partie (phase='over') compte.
  'menu.dailyClash.title': 'Duel du jour',
  'menu.dailyClash.status.pending': 'Joue aujourd\'hui pour {streak} jours d\'affilée · +{coins} pièces à la fin',
  'menu.dailyClash.status.done': 'Terminé aujourd\'hui ! {streak} jours d\'affilée · à demain',
  'menu.dailyClash.play': 'Jouer le duel du jour',
  'menu.dailyClash.doneButton': 'Terminé',

  'menu.mode': 'DURÉE',

  'menu.mode.60': '1 min',

  'menu.mode.180': '3 min',

  'menu.mode.300': '5 min',

  'menu.mode.desc': 'Carte {cols} × {rows} · {players} joueurs',

  'menu.difficulty': 'DIFFICULTÉ',

  'menu.difficulty.auto': 'Auto',

  'menu.difficulty.easy': 'Facile',

  'menu.difficulty.normal': 'Normal',

  'menu.difficulty.hard': 'Difficile',

  'menu.difficulty.elite': 'Élite',

  'menu.difficulty.auto.hint': 'La difficulté s\'ajuste automatiquement à tes derniers résultats.', // ★2026-08-22 T5: "bots" retiré

  'menu.best': 'Record dans ce mode',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': 'Commencer',


  'hud.rank.unit': 'RANG',
  'hud.time.unit': 'SEC',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': 'TEMPS',
  'hud.rate': '+{rate}/s',
  'hud.bounce': 'Rebond',
  'hud.bounce.aria': 'Triple rebond',

  'modal.pause.title': 'Pause',
  'modal.pause.body': 'Le jeu est en pause. Appuyez à nouveau sur Retour pour ouvrir la confirmation de sortie.',
  'modal.pause.resume': 'Reprendre',
  'modal.revive.title': 'Vous avez perdu tout votre territoire',
  'modal.revive.body': 'Vous pouvez réapparaître en {size} sur un terrain libre. Seulement {limit} par partie.',
  'modal.revive.limit': 'une fois',
  'modal.revive.decline': 'Résultats',
  'modal.revive.accept': 'Renaître',
  'modal.revive.body.free': 'Vous pouvez réapparaître en {size} sur un terrain libre. Gratuit {limit} par partie.',
  'modal.revive.body.ad': 'Regardez une courte publicité pour revenir une fois de plus.',
  'modal.revive.accept.ad': 'Voir une pub',
  'modal.revive.loading': 'Chargement de la pub…',
  'modal.exit.title': 'Quitter la partie ?',
  'modal.exit.body': 'La partie en cours ne sera pas enregistrée.',
  'modal.exit.confirm': 'Quitter',
  'modal.exit.cancel': 'Continuer',

  'result.newBest': 'Nouveau record !',
  'result.cells': 'Territoire final',
  'result.income': 'Revenus fonciers',
  'result.kills': 'Éliminations',
  'result.maxTrail': 'Plus long tracé',
  'result.coins': 'Pièces gagnées',
  'result.xp': 'XP',
  'result.restart': 'Rejouer',

  'result.changeMode': 'Changer de mode',

  'result.mode': '{mode} · {players} joueurs',
  'result.value.cells': '{percent} %',
  'result.value.kills': '{count}',
  'result.value.trail': '{count} cases',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': 'Carrière',
  'career.plays': 'Parties jouées',
  'career.wins': 'Premières places',
  'career.kills': 'Éliminations totales',
  'career.xp': 'XP total',
  'career.value.plays': '{count}',
  'career.value.wins': '{count}',
  'career.value.kills': '{count}',
  'career.value.xp': '{count}',

  'fx.kill': 'Éliminé !',

  'tier.normal': 'Standard',
  'tier.commercial': 'Commercial',
  'tier.special': 'Spécial',
  'tier.label': '{name} ({value}/s)',

  'unit.you': 'Vous',
  'unit.ghost': '{nick} d\'hier',

  'error.fatal.title': 'Une erreur est survenue',
  'error.noCanvas': 'Impossible de lancer le jeu (élément canvas introuvable).',
  'error.sdkInit': 'Échec de l\'initialisation du SDK.',
  'error.gameStart': 'Échec du lancement du jeu.',

  'settings.language': 'Langue',
  'settings.privacyLink': 'Politique de confidentialité',
  'settings.sound': 'Son',
  'settings.sound.on': 'Activé',
  'settings.sound.off': 'Désactivé',

  // ── Push Toss (Duel du jour) — ★2026-09-10. Dessiné uniquement dans Toss (src/ui/pushOptIn.ts).
  'push.row.label': 'Alerte du Duel du jour',
  'push.row.get': 'Activer',
  'push.row.busy': 'Vérification',
  'push.row.on': 'Activée',
  'push.row.retry': 'Réactiver',
  'push.row.hint': 'On te prévient chaque jour à 19 h (KST) quand la nouvelle carte du Duel du jour ouvre. Pour la désactiver, utilise les réglages de notifications de l\'app Toss.',
  'push.row.error': 'Impossible d\'ouvrir les réglages de notifications. Mets à jour l\'app Toss puis touche à nouveau.',
  'push.nudge.title': 'Recevoir les alertes du Duel du jour',
  'push.nudge.sub': 'Chaque jour à 19 h (KST), quand la nouvelle carte ouvre',
  'push.nudge.cta': 'Activer',
  'push.nudge.busy': 'Vérification',
  'push.nudge.close': 'Fermer l\'alerte',

  // ── Carte de suggestion « Money League » (écran de résultat, 1 fois par jour) — ★2026-09-10 (src/ui/crossPromo.ts).
  'promo.ml.label': 'Suggestion',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': 'Investissement virtuel dans une ligue de 10 000 bots',
  'promo.ml.open': 'Ouvrir',
  'promo.ml.close': 'Fermer la suggestion',
  'promo.ml.fail': 'Ouverture impossible pour le moment. Cherche Money League dans l\'app Toss.',

  'nick.name.0': 'Averse Rapide',
  'nick.name.1': 'Pissenlit Rapide',
  'nick.name.2': 'Pie Rapide',
  'nick.name.3': 'Couchant Rapide',
  'nick.name.4': 'Crayon Rapide',
  'nick.name.5': 'Cigogne Rapide',
  'nick.name.6': 'Moulin à Vent Rapide',
  'nick.name.7': 'Bouton Rapide',
  'nick.name.8': 'Averse Sereine',
  'nick.name.9': 'Pissenlit Serein',
  'nick.name.10': 'Pie Sereine',
  'nick.name.11': 'Couchant Serein',
  'nick.name.12': 'Crayon Serein',
  'nick.name.13': 'Cigogne Sereine',
  'nick.name.14': 'Moulin à Vent Serein',
  'nick.name.15': 'Bouton Serein',
  'nick.name.16': 'Averse Bleue',
  'nick.name.17': 'Pissenlit Bleu',
  'nick.name.18': 'Pie Bleue',
  'nick.name.19': 'Couchant Bleu',
  'nick.name.20': 'Crayon Bleu',
  'nick.name.21': 'Cigogne Bleue',
  'nick.name.22': 'Moulin à Vent Bleu',
  'nick.name.23': 'Bouton Bleu',
  'nick.name.24': 'Petite Averse',
  'nick.name.25': 'Petit Pissenlit',
  'nick.name.26': 'Petite Pie',
  'nick.name.27': 'Petit Couchant',
  'nick.name.28': 'Petit Crayon',
  'nick.name.29': 'Petite Cigogne',
  'nick.name.30': 'Petit Moulin à Vent',
  'nick.name.31': 'Petit Bouton',
  'nick.name.32': 'Averse Profonde',
  'nick.name.33': 'Pissenlit Profond',
  'nick.name.34': 'Pie Profonde',
  'nick.name.35': 'Couchant Profond',
  'nick.name.36': 'Crayon Profond',
  'nick.name.37': 'Cigogne Profonde',
  'nick.name.38': 'Moulin à Vent Profond',
  'nick.name.39': 'Bouton Profond',
  'nick.name.40': 'Averse Claire',
  'nick.name.41': 'Pissenlit Clair',
  'nick.name.42': 'Pie Claire',
  'nick.name.43': 'Couchant Clair',
  'nick.name.44': 'Crayon Clair',
  'nick.name.45': 'Cigogne Claire',
  'nick.name.46': 'Moulin à Vent Clair',
  'nick.name.47': 'Bouton Clair',
  'nick.name.48': 'Averse Ronde',
  'nick.name.49': 'Pissenlit Rond',
  'nick.name.50': 'Pie Ronde',
  'nick.name.51': 'Couchant Rond',
  'nick.name.52': 'Crayon Rond',
  'nick.name.53': 'Cigogne Ronde',
  'nick.name.54': 'Moulin à Vent Rond',
  'nick.name.55': 'Bouton Rond',
  'nick.name.56': 'Averse Solide',
  'nick.name.57': 'Pissenlit Solide',
  'nick.name.58': 'Pie Solide',
  'nick.name.59': 'Couchant Solide',
  'nick.name.60': 'Crayon Solide',
  'nick.name.61': 'Cigogne Solide',
  'nick.name.62': 'Moulin à Vent Solide',
  'nick.name.63': 'Bouton Solide',

  'bot.name.0': 'Agence Assidue',
  'bot.name.1': 'Rentier Assidu',
  'bot.name.2': 'Géomètre Assidu',
  'bot.name.3': 'Pionnier Assidu',
  'bot.name.4': 'Architecte Assidu',
  'bot.name.5': 'Investisseur Assidu',
  'bot.name.6': 'Courtier Assidu',
  'bot.name.7': 'Roi des Terres Assidu',
  'bot.name.8': 'Agence Froide',
  'bot.name.9': 'Rentier Froid',
  'bot.name.10': 'Géomètre Froid',
  'bot.name.11': 'Pionnier Froid',
  'bot.name.12': 'Architecte Froid',
  'bot.name.13': 'Investisseur Froid',
  'bot.name.14': 'Courtier Froid',
  'bot.name.15': 'Roi des Terres Froid',
  'bot.name.16': 'Agence Détendue',
  'bot.name.17': 'Rentier Détendu',
  'bot.name.18': 'Géomètre Détendu',
  'bot.name.19': 'Pionnier Détendu',
  'bot.name.20': 'Architecte Détendu',
  'bot.name.21': 'Investisseur Détendu',
  'bot.name.22': 'Courtier Détendu',
  'bot.name.23': 'Roi des Terres Détendu',
  'bot.name.24': 'Agence Tenace',
  'bot.name.25': 'Rentier Tenace',
  'bot.name.26': 'Géomètre Tenace',
  'bot.name.27': 'Pionnier Tenace',
  'bot.name.28': 'Architecte Tenace',
  'bot.name.29': 'Investisseur Tenace',
  'bot.name.30': 'Courtier Tenace',
  'bot.name.31': 'Roi des Terres Tenace',
  'bot.name.32': 'Agence Discrète',
  'bot.name.33': 'Rentier Discret',
  'bot.name.34': 'Géomètre Discret',
  'bot.name.35': 'Pionnier Discret',
  'bot.name.36': 'Architecte Discret',
  'bot.name.37': 'Investisseur Discret',
  'bot.name.38': 'Courtier Discret',
  'bot.name.39': 'Roi des Terres Discret',
  'bot.name.40': 'Agence Audacieuse',
  'bot.name.41': 'Rentier Audacieux',
  'bot.name.42': 'Géomètre Audacieux',
  'bot.name.43': 'Pionnier Audacieux',
  'bot.name.44': 'Architecte Audacieux',
  'bot.name.45': 'Investisseur Audacieux',
  'bot.name.46': 'Courtier Audacieux',
  'bot.name.47': 'Roi des Terres Audacieux',
  'bot.name.48': 'Agence Méticuleuse',
  'bot.name.49': 'Rentier Méticuleux',
  'bot.name.50': 'Géomètre Méticuleux',
  'bot.name.51': 'Pionnier Méticuleux',
  'bot.name.52': 'Architecte Méticuleux',
  'bot.name.53': 'Investisseur Méticuleux',
  'bot.name.54': 'Courtier Méticuleux',
  'bot.name.55': 'Roi des Terres Méticuleux',
  'bot.name.56': 'Agence Perspicace',
  'bot.name.57': 'Rentier Perspicace',
  'bot.name.58': 'Géomètre Perspicace',
  'bot.name.59': 'Pionnier Perspicace',
  'bot.name.60': 'Architecte Perspicace',
  'bot.name.61': 'Investisseur Perspicace',
  'bot.name.62': 'Courtier Perspicace',
  'bot.name.63': 'Roi des Terres Perspicace',
};

export default fr;
