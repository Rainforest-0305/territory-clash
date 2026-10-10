/**
 * 효과음 켜기/끄기 토글 — 언어 선택(.tc-lang)과 같은 행 문법으로 시작 메뉴·일시정지 시트에 붙는다.
 *
 * ★ 접근성: <button aria-pressed> 스위치. 라벨(효과음)은 보이는 텍스트 그대로, 상태(켜짐/꺼짐)는
 *   버튼 텍스트로 드러난다. 색만으로 상태를 전하지 않는다.
 * ★ 저장: index.ts 가 setSoundPersist() 로 KEYS.settings 합류 쓰기를 등록한다(read-modify-write).
 *   등록 전에는 세션 안에서만 유지된다 — 게임은 그대로 돈다.
 */
import { onLocaleChange, t } from '../i18n';
import { sfx } from '../game/sfx';

let persist: ((on: boolean) => void) | null = null;
const listeners = new Set<() => void>();

export function setSoundPersist(fn: (on: boolean) => void): void {
  persist = fn;
}

/** 외부(부팅 시 저장값)에서 상태를 바꾸면 모든 토글이 따라간다. */
export function setSoundEnabled(on: boolean, save = false): void {
  sfx.setEnabled(on);
  if (save) persist?.(on);
  for (const l of listeners) l();
}

export function createSoundToggle(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tc-lang tc-sound';

  const label = document.createElement('span');
  label.className = 'tc-lang-label';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tc-switch';
  const knob = document.createElement('i');
  knob.setAttribute('aria-hidden', 'true');
  const state = document.createElement('b');
  btn.append(knob, state);

  const render = () => {
    const on = sfx.enabled;
    label.textContent = t('settings.sound');
    state.textContent = on ? t('settings.sound.on') : t('settings.sound.off');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', t('settings.sound'));
    btn.classList.toggle('on', on);
  };
  render();

  btn.addEventListener('click', () => {
    const next = !sfx.enabled;
    sfx.unlock();
    setSoundEnabled(next, true);
    if (next) sfx.play('tap');
  });

  listeners.add(render);
  const off = onLocaleChange(() => {
    if (!wrap.isConnected) {
      off();
      listeners.delete(render);
      return;
    }
    render();
  });

  wrap.append(label, btn);
  return wrap;
}
