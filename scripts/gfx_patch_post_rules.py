# -*- coding: utf-8 -*-
"""
2026-08-30 추가 규칙(네온 -22 「장애물 깜빡임」 재발 방지) — post.ts 티어 컨트롤러 패치.
  python scripts/gfx_patch_post_rules.py
입력: src/game/post.ts (1차 레인 판, 백업 scripts/_bak/post_20260830-0231.ts)
멱등: 이미 패치된 파일이면 아무것도 안 한다.
"""
import io, os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
P = os.path.join(ROOT, 'src', 'game', 'post.ts')
s = io.open(P, encoding='utf-8').read()
if 'MIN_DWELL_MS' in s:
    print('already patched'); sys.exit(0)

def rep(a, b, n=1):
    global s
    if a not in s:
        raise SystemExit('ANCHOR NOT FOUND:\n' + a[:200])
    s = s.replace(a, b, n)

rep(""" * ── 픽셀 예산 (네온 2차 교훈: iPhone DPR3 에서 풀해상도 업로드가 프레임을 먹었다) ──
 * scene 캔버스 DPR 은 화면 DPR 이 아니라 «예산»으로 정한다.
 *   q0: w×h×min(dpr,2)² > 1.0M px 면 1.5, 아니면 2 / q1: 1.25 / q2: 1.0
 * 블룸 체인은 q0 = 1/4 타이트 + 1/8 와이드 / q1 = 1/4 만 / q2 = 1/8 만.
 * 30프레임 창에서 19ms 초과가 5회 이상이면 한 단계 강등, 6창 연속 0회면 회복.
 * 최후 보험: q2 에서도 22ms 초과가 90프레임 중 25% 를 넘으면 세션 내 블룸 완전 off.
 */""",
""" * ── 픽셀 예산 (네온 2차 교훈: iPhone DPR3 에서 풀해상도 업로드가 프레임을 먹었다) ──
 * scene 캔버스 DPR 은 화면 DPR 이 아니라 «예산»으로 정한다: w×h×min(dpr,2)² > 1.0M px 면 1.5, 아니면 2.
 * ★이 값은 (w,h,dpr) 만의 함수다 — 품질 단계가 바뀌어도 «캔버스 크기는 플레이 중 절대 바뀌지 않는다»
 *   (네온 -22 실기기 「장애물이 계속 깜빡거려」 사후분석: 단계 전환마다 scene/GL 캔버스 크기가 바뀌며
 *   재할당·재업로드·보간 변화가 «깜빡임»으로 보였다). 단계는 «블러 체인»만 바꾼다.
 *
 * ── 동적 품질 3단계 + 히스테리시스 (2026-08-30 규칙) ──
 *   q0 = 1/4 타이트 + 1/8 와이드 (6패스) / q1 = 1/4 만 (3패스) / q2 = 1/8 만 (4패스)
 *   판정 창 30프레임: 19ms 초과 ≥5/30 → 강등 후보. 단, 어느 단계든 «최소 체류 8초» 전엔 전환하지 않는다.
 *   회복(승격): 창에서 19ms 초과 ≤1 인 «깨끗한» 시간이 15초 연속 쌓여야 한 단계 올린다. 세션당 승격 ≤2회.
 *   모든 전환은 400ms 크로스페이드(합성 계수 lerp — 페이드 중엔 양쪽 단계의 «원래» 버퍼를 둘 다 계산해
 *   섞으므로 페이드 끝에서 튀지 않는다). 즉 화면이 «확» 바뀌는 순간이 없다.
 *   최후 보험(불가역): q2 에서 8초 이상 머문 뒤에도 33ms 초과가 90프레임 중 25% 를 넘으면 블룸 패스를
 *   «끈다». 씬 업로드 + 합성 1패스는 그대로 — 캔버스 크기·경로가 안 바뀌고(규칙 3), 캔버스 블룸
 *   폴백보다 빠르다(실측: CPU 8× 폴백 43fps < GL 46fps). 세션 안에서 다시 켜지지 않는다.
 *   전환 기록(qlog: [프레임, 단계, 사유, 세션 경과 ms])은 ?diag=1 로 읽는다.
 */""")

rep("""  'float n=fract(sin(dot(gl_FragCoord.xy+seed,vec2(12.9898,78.233)))*43758.5453);c+=(n-.5)*grain;' +
  'gl_FragColor=vec4(min(c,1.),1.);}';""",
"""  'float n=fract(sin(dot(gl_FragCoord.xy+seed,vec2(12.9898,78.233)))*43758.5453);c+=(n-.5)*grain;' +
  /* soft-knee (0.8 부터 완만히 1.0 으로, C1 연속) — 하드 클립 min(c,1) 은 밝은 림이 겹치는 곳에서 «면»으로 터진다 */
  'vec3 k=step(vec3(.8),c);c=mix(c,.8+.2*(1.-exp(-(c-.8)*5.)),k);' +
  'gl_FragColor=vec4(clamp(c,0.,1.),1.);}';""")

rep("const Q_DPR = [0, 1.25, 1.0] as const;\n\n",
"""/** 최소 체류(어떤 단계든 이 시간 전엔 전환 없음) */
const MIN_DWELL_MS = 8000;
/** 회복(승격)에 필요한 연속 «깨끗한» 시간 */
const RECOVER_MS = 15000;
/** 세션당 승격 상한 */
const MAX_PROMOS = 2;
/** 전환 크로스페이드 */
const FADE_MS = 400;

""")

rep("""  /** 최후 보험이 발동했는가(세션 내 1회) */
  autoOff = false;
  /** 동적 품질 0 양호 / 1 주의 / 2 위험 */
  q = 0;
  adaptive = true;
  /** 최후 보험(세션 내 완전 off) 사용 여부. ?autooff=0 이면 끈다(계측용). */
  auto = true;
  frames = 0;
  qChanges = 0;
  readonly qlog: Array<[number, number, string]> = [];""",
"""  /** 최후 보험이 발동했는가(세션 내 1회, 불가역) — 블룸 패스 off, GL 합성은 유지 */
  autoOff = false;
  /** 동적 품질 0 양호 / 1 주의 / 2 위험 */
  q = 0;
  adaptive = true;
  /** 최후 보험 사용 여부. ?autooff=0 이면 끈다(계측용). */
  auto = true;
  frames = 0;
  qChanges = 0;
  /** [프레임, 단계(3=블룸 off), 사유, 세션 경과 ms] */
  readonly qlog: Array<[number, number, string, number]> = [];
  /** 세션(아레나) 경과 ms — 플레이 중 프레임만 누적 */
  tierMs = 0;
  /** 마지막 단계 전환 뒤 경과 ms(최소 체류 판정) */
  private sinceChange = 0;
  /** 연속 «깨끗한» 시간 ms(회복 판정) */
  private cleanMs = 0;
  /** 이번 세션 승격 횟수 */
  promos = 0;
  /** 크로스페이드: 이전 단계(-1 = 없음) → 현재 단계, fadeT 0..FADE_MS */
  private fadeFrom = -1;
  private fadeT = 0;
  /** 페이드 중인가(계측용) */
  get fading(): boolean {
    return this.fadeFrom >= 0;
  }""")

rep("""  private win = new Float32Array(90);
  private wi = 0;
  private wn = 0;
  private qw = 0;
  private qbad = 0;
  private qgood = 0;
  private qhold = 0;
""", """  private win = new Float32Array(90);
  private wi = 0;
  private wn = 0;
  private qw = 0;
  private qbad = 0;
  private qwMs = 0;
""")

rep("""  /** 이 프레임의 scene DPR(픽셀 예산). 렌더러가 emissive 버퍼 크기를 맞추는 데 쓴다. */
  budgetDpr(w: number, h: number, dpr: number): number {
    const cap0 = w * h * Math.min(dpr, 2) * Math.min(dpr, 2) > 1000000 ? 1.5 : 2;
    return Math.min(dpr, this.q ? Q_DPR[this.q]! : cap0);
  }""",
"""  /** scene DPR(픽셀 예산). (w,h,dpr) 만의 함수 — 품질 단계와 «무관»하다(플레이 중 캔버스 크기 불변). */
  budgetDpr(w: number, h: number, dpr: number): number {
    const cap0 = w * h * Math.min(dpr, 2) * Math.min(dpr, 2) > 1000000 ? 1.5 : 2;
    return Math.min(dpr, cap0);
  }""")

rep("""    // 2) emissive 업로드 (프리멀티플라이 — 가산 합성에 바로 쓴다)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    if (!this.emisTex) this.emisTex = this.makeTex(0, 0);
    this.tex(0, this.emisTex);
    if (!this.emisUploaded || this.EW !== emissive.width || this.EH !== emissive.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
      this.emisUploaded = true;
      this.EW = emissive.width;
      this.EH = emissive.height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
""", """    // 2) emissive 업로드 (프리멀티플라이 — 가산 합성에 바로 쓴다). 블룸 off 가 확정되면(페이드 끝) 건너뛴다.
    if (!this.emisTex) this.emisTex = this.makeTex(0, 0);
    if (!this.autoOff || this.fadeFrom >= 0) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      this.tex(0, this.emisTex);
      if (!this.emisUploaded || this.EW !== emissive.width || this.EH !== emissive.height) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
        this.emisUploaded = true;
        this.EW = emissive.width;
        this.EH = emissive.height;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
      }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }
""")

start = s.index("    const { a1, b1, a2, b2 } = this.fbo as Required<typeof this.fbo>;")
endi = s.index("    this.frames++;\n  }", start) + len("    this.frames++;\n  }")
NEW_CHAIN = """    const { a1, b1, a2, b2 } = this.fbo as Required<typeof this.fbo>;
    const blur = this.prog.blur!;
    const down = this.prog.down!;
    const comp = this.prog.comp!;
    const emis = this.emisTex;
    const compose = (t1: WebGLTexture, t2: WebGLTexture, k1: number, k2: number) => {
      this.pass(comp, null, (u) => {
        this.tex(0, this.sceneTex);
        this.tex(1, t1);
        this.tex(2, t2);
        gl.uniform1i(u.s!, 0);
        gl.uniform1i(u.b1!, 1);
        gl.uniform1i(u.b2!, 2);
        gl.uniform1f(u.k1!, k1);
        gl.uniform1f(u.k2!, k2);
        gl.uniform1f(u.vig!, 0.5);
        gl.uniform1f(u.urgent!, p.urgent);
        gl.uniform1f(u.desat!, p.desat);
        gl.uniform1f(u.grain!, p.grain);
        gl.uniform1f(u.seed!, (this.frames % 97) * 7.31);
      });
    };
    /* 체인 조각 — 각 단계의 «원래» 버퍼. 페이드 중엔 두 단계의 조각을 «둘 다» 만들어 계수만 섞는다. */
    const chainA1 = () => {
      // 1/4 타이트: emis → b1 → a1
      this.pass(blur, b1, (u) => {
        this.tex(0, emis);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 1 / a1.w, 0);
        gl.uniform1f(u.flip!, 1);
      });
      this.pass(blur, a1, (u) => {
        this.tex(0, b1.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 0, 1 / a1.h);
        gl.uniform1f(u.flip!, 0);
      });
    };
    const chainA2fromA1 = () => {
      // 1/8 와이드(q0): a1 → a2 → b2 → a2
      this.pass(down, a2, (u) => {
        this.tex(0, a1.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.px!, 1 / a1.w, 1 / a1.h);
      });
      this.pass(blur, b2, (u) => {
        this.tex(0, a2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 1 / a2.w, 0);
        gl.uniform1f(u.flip!, 0);
      });
      this.pass(blur, a2, (u) => {
        this.tex(0, b2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 0, 1 / a2.h);
        gl.uniform1f(u.flip!, 0);
      });
    };
    const chainA2fromEmis = () => {
      // 1/8 만(q2): emis → a2(다운) → b2 → a2. down 은 flip 을 모른다 → 첫 블러에서 뒤집는다.
      this.pass(down, a2, (u) => {
        this.tex(0, emis);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.px!, 1 / a1.w, 1 / a1.h);
      });
      this.pass(blur, b2, (u) => {
        this.tex(0, a2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 1 / a2.w, 0);
        gl.uniform1f(u.flip!, 1);
      });
      this.pass(blur, a2, (u) => {
        this.tex(0, b2.t);
        gl.uniform1i(u.s!, 0);
        gl.uniform2f(u.d!, 0, 1 / a2.h);
        gl.uniform1f(u.flip!, 0);
      });
    };
    /* 단계별 합성 계수 (a1 계수, a2 계수). 3 = 블룸 off. */
    const K = (t: number): [number, number] =>
      t === 0
        ? [this.tight, this.wide]
        : t === 1
          ? [this.tight + this.wide * 0.35, 0]
          : t === 2
            ? [0, this.tight * 0.7 + this.wide]
            : [0, 0];

    const cur = this.autoOff ? 3 : this.q;
    if (this.fadeFrom >= 0) {
      // ── 크로스페이드: from → cur. 두 단계가 쓰는 조각을 전부 «원래 방식»으로 만들고 계수만 섞는다.
      const from = this.fadeFrom;
      const f = Math.min(1, this.fadeT / FADE_MS);
      const e = f * f * (3 - 2 * f);
      const ka = K(from);
      const kb = K(cur);
      const k1 = ka[0] + (kb[0] - ka[0]) * e;
      const k2 = ka[1] + (kb[1] - ka[1]) * e;
      const pair = from + cur; // 0↔1 = 1, 1↔2 = 3, 2↔3 = 5
      if (pair === 1) {
        chainA1();
        chainA2fromA1();
        compose(a1.t, a2.t, k1, k2);
      } else if (pair === 3) {
        chainA1();
        chainA2fromEmis();
        compose(a1.t, a2.t, k1, k2);
      } else {
        chainA2fromEmis();
        compose(a2.t, a2.t, 0, k2);
      }
      if (f >= 1) this.fadeFrom = -1;
    } else if (cur === 0) {
      chainA1();
      chainA2fromA1();
      compose(a1.t, a2.t, this.tight, this.wide);
    } else if (cur === 1) {
      chainA1();
      compose(a1.t, a1.t, this.tight + this.wide * 0.35, 0);
    } else if (cur === 2) {
      chainA2fromEmis();
      compose(a2.t, a2.t, 0, this.tight * 0.7 + this.wide);
    } else {
      // 블룸 off(최후 보험): 씬 + 비네트·틴트·채도·그레인만. 블러 패스 0.
      compose(a2.t, a2.t, 0, 0);
    }
    this.frames++;
  }"""
s = s[:start] + NEW_CHAIN + s[endi:]

start = s.index("  setEnabled(v: boolean): void {")
endi = s.index("  /** 메뉴/스플래시에서는 GL 캔버스를 감춘다")
s = s[:start] + """  /** 끄기만 가능(컨텍스트 손실 등). 최후 보험(autoOff)은 이 메서드로도 «되돌리지 않는다» — 불가역. */
  setEnabled(v: boolean): void {
    if (!this.supported) return;
    this.on = !!v && !this.lost;
    this.glc.style.visibility = this.on ? 'visible' : 'hidden';
  }

""" + s[endi:]

start = s.index("  private setQ(nq: number, why: string): void {")
s = s[:start] + """  private setQ(nq: number, why: string): void {
    nq = nq < 0 ? 0 : nq > 2 ? 2 : nq;
    if (nq === this.q) return;
    const from = this.autoOff ? 3 : this.q;
    this.q = nq;
    this.qChanges++;
    this.sinceChange = 0;
    this.cleanMs = 0;
    this.fadeFrom = from;
    this.fadeT = 0;
    if (this.qlog.length < 64) this.qlog.push([this.frames, nq, why, Math.round(this.tierMs)]);
    console.info('[post] quality -> q' + nq + ' (' + why + ') @' + Math.round(this.tierMs) + 'ms');
  }

  /** 페이드 진행 — 매 프레임(일시정지·메뉴 포함) 시간을 먹인다. 렌더러가 draw() 에서 부른다. */
  tick(ms: number): void {
    if (this.fadeFrom >= 0) this.fadeT += ms;
  }

  /**
   * 60fps 감시. 플레이 중 프레임 간격(ms)을 매 프레임 넣어준다. 판정은 렌더에만 영향 — 게임 로직·판정과 무관.
   * 규칙(2026-08-30): 최소 체류 8s · 회복 15s 연속 깨끗 · 세션당 승격 ≤2 · 전환은 400ms 페이드 · 보험은 불가역.
   */
  sample(ms: number): void {
    if (!this.on) return;
    this.tierMs += ms;
    this.sinceChange += ms;
    if (this.adaptive && !this.autoOff) {
      this.qw++;
      this.qwMs += ms;
      if (ms > 19) this.qbad++;
      if (this.qw >= 30) {
        if (this.qbad <= 1) this.cleanMs += this.qwMs;
        else this.cleanMs = 0;
        if (this.qbad >= 5) {
          if (this.q < 2 && this.sinceChange >= MIN_DWELL_MS) this.setQ(this.q + 1, 'bad ' + this.qbad + '/30');
        } else if (
          this.cleanMs >= RECOVER_MS &&
          this.q > 0 &&
          this.promos < MAX_PROMOS &&
          this.sinceChange >= RECOVER_MS
        ) {
          this.promos++;
          this.setQ(this.q - 1, 'clean ' + Math.round(this.cleanMs / 1000) + 's #' + this.promos);
        }
        this.qw = 0;
        this.qbad = 0;
        this.qwMs = 0;
      }
    }
    if (!this.auto || this.autoOff || (this.adaptive && this.q < 2)) return;
    this.win[this.wi] = ms;
    this.wi = (this.wi + 1) % 90;
    if (this.wn < 90) this.wn++;
    if (this.wn < 90 || this.sinceChange < MIN_DWELL_MS) return;
    /* 33ms(= 2프레임) 초과가 90프레임 중 25% — q2 에서 8초 이상 버틴 뒤에만. 발동하면 세션 내 불가역. */
    let bad = 0;
    for (let i = 0; i < 90; i++) if (this.win[i]! > 33) bad++;
    if (bad > 22) {
      this.autoOff = true;
      this.fadeFrom = 2;
      this.fadeT = 0;
      this.sinceChange = 0;
      this.wn = 0;
      if (this.qlog.length < 64) this.qlog.push([this.frames, 3, 'off ' + bad + '/90', Math.round(this.tierMs)]);
      console.info('[post] bloom passes off, irreversible (' + bad + '/90 frames > 33ms) @' + Math.round(this.tierMs) + 'ms');
    }
  }

  /** 새 아레나: 창·세션 카운터 리셋. 단계(q)와 보험(autoOff)은 «유지» — 판 시작마다 화면이 튀지 않게. */
  resetWindow(): void {
    this.wn = 0;
    this.wi = 0;
    this.qw = 0;
    this.qbad = 0;
    this.qwMs = 0;
    this.cleanMs = 0;
    this.tierMs = 0;
    this.sinceChange = 0;
    this.promos = 0;
  }
}
"""
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('patched post.ts', len(s))
