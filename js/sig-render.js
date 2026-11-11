// 메일 서명 윗부분(그라디언트·이름·연락처) 이미지를 캔버스로 그린다.
(function (root) {
  const S = root.SigCore;
  const INK = '#212124', GRAY = '#6B6B70';
  const MAXW = 432;           // 글자가 들어갈 폭 (480 - 좌우 여백 24×2)
  const FAMILY = "'Asta Sans SIG'";
  const OUT_SCALE = 2;
  let ready = null;

  function load(base) {
    if (ready) return ready;
    base = base || '';
    const face = new FontFace('Asta Sans SIG', `url(${base}assets/AstaSans-UI.woff2)`, { weight: '300 800' });
    const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src + ' 을(를) 불러오지 못했습니다.')); i.src = src; });
    ready = Promise.all([
      face.load().then((f) => { document.fonts.add(f); return f; }),
      fetch(base + 'assets/email/sig/common/layout.json?v=' + S.COMMON_VER).then((r) => r.json()),
      img(base + 'assets/email/sig/common/kr/tpl.png?v=' + S.COMMON_VER),
      img(base + 'assets/email/sig/common/en/tpl.png?v=' + S.COMMON_VER)
    ]).then(([, layout, kr, en]) => ({ layout, tpl: { kr, en } }));
    return ready;
  }

  const font = (w, px) => `${w} ${px}px ${FAMILY}`;
  function width(ctx, text, w, px, ls) {
    ctx.font = font(w, px);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (ls || 0) + 'px';
    const m = ctx.measureText(text).width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return m;
  }
  function draw(ctx, text, x, y, w, px, color, ls) {
    ctx.font = font(w, px); ctx.fillStyle = color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (ls || 0) + 'px';
    ctx.fillText(text, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return width(ctx, text, w, px, ls);
  }

  // 폭을 넘으면 글자 크기를 조금씩 줄인다. 줄인 내역은 warn에 남긴다.
  function fitLine1(ctx, L) {
    let n = 21, t = 15, gap = 9;
    const w = () => width(ctx, L.name, 700, n, -0.2) + (L.title ? gap + width(ctx, L.title, 500, t) : 0);
    while (w() > MAXW && t > 12) t -= 0.5;
    while (w() > MAXW && n > 17) n -= 0.5;
    return { n, t, gap, over: w() > MAXW };
  }
  function fitLine2(ctx, L) {
    let s = 13;
    while (width(ctx, L.sub, 400, s) > MAXW && s > 11) s -= 0.5;
    return { s, over: width(ctx, L.sub, 400, s) > MAXW };
  }
  function line3Parts(L) { return [['M', L.m], ['T', L.t], ['E', L.e]]; }
  function line3Width(ctx, L, v, g) {
    let w = 0;
    line3Parts(L).forEach(([k, val], i) => { w += width(ctx, k, 600, 12.5) + 6 + width(ctx, val, 400, v) + (i < 2 ? g : 0); });
    return w;
  }
  function fitLine3(ctx, L) {
    let v = 14.5, g = 14;
    while (line3Width(ctx, L, v, g) > MAXW && g > 10) g -= 1;
    while (line3Width(ctx, L, v, g) > MAXW && v > 12.5) v -= 0.5;
    return { v, g, over: line3Width(ctx, L, v, g) > MAXW };
  }

  function missingGlyphs(L) {
    const set = root.SIG_HANGUL || '';
    const all = [L.name, L.title, L.sub].join('');
    return [...new Set([...all].filter((ch) => /[가-힣]/.test(ch) && !set.includes(ch)))];
  }

  // 사람·언어 하나의 윗부분 이미지를 만든다. → { canvas, warn[] }
  async function top(p, lang, base) {
    const A = await load(base);
    // 사람별 이미지는 2배율로 만든다(3배율 대비 파일 크기 약 절반, 레티나 화면에서도 선명).
    const lay = A.layout[lang], sc = OUT_SCALE;
    const cv = document.createElement('canvas');
    cv.width = lay.W * sc; cv.height = lay.top * sc;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(A.tpl[lang], 0, 0, cv.width, cv.height);
    ctx.scale(sc, sc);
    ctx.textBaseline = 'alphabetic';
    const L = S.lines(p, lang), warn = [];
    const f1 = fitLine1(ctx, L), f2 = fitLine2(ctx, L), f3 = fitLine3(ctx, L);
    if (f1.n < 21 || f1.t < 15) warn.push('이름·직함 줄이 길어 글자를 조금 줄였습니다.');
    if (f2.s < 13) warn.push('둘째 줄이 길어 글자를 조금 줄였습니다.');
    if (f3.v < 14.5 || f3.g < 14) warn.push('연락처 줄이 길어 간격이나 글자를 조금 줄였습니다.');
    if (f1.over || f2.over || f3.over) warn.push('글자가 서명 폭을 넘습니다. 직함이나 영문 표기를 줄여 주세요.');
    const miss = missingGlyphs(L);
    if (miss.length) warn.push(`서체에 없는 글자(${miss.join(', ')})가 있어 다른 서체로 그려집니다.`);

    let x = lay.x;
    x += draw(ctx, L.name, x, lay.b1, 700, f1.n, INK, -0.2);
    if (L.title) draw(ctx, L.title, x + f1.gap, lay.b1, 500, f1.t, INK);
    if (L.sub) draw(ctx, L.sub, lay.x, lay.b2, 400, f2.s, GRAY);
    x = lay.x;
    line3Parts(L).forEach(([k, val], i) => {
      x += draw(ctx, k, x, lay.b3, 600, 12.5, GRAY) + 6;
      x += draw(ctx, val, x, lay.b3, 400, f3.v, INK) + (i < 2 ? f3.g : 0);
    });
    return { canvas: cv, warn };
  }

  const toBlob = (cv) => new Promise((ok) => cv.toBlob(ok, 'image/png'));

  root.SigRender = { load, top, toBlob };
})(window);
