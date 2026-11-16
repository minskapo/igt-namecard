// 기관 메일 서명: 서명 HTML·글자 서명 만들기와 페이지 동작 (브라우저·Node 겸용)
(function (root) {
  const D = root.SigOrgDef || require('./sig-org-def.js');
  const SITE = 'https://minskapo.github.io/igt-namecard/';
  const VER = '20261116c';
  const W = 602, H = 267, TOP = 211, BOT = 249, R3 = [109, 133];
  const UTM = { source: 'signature', medium: 'email', campaign: 'email_signature' };
  const utm = (url, id, term) => url + (url.includes('?') ? '&' : '?') +
    ['utm_source=' + UTM.source, 'utm_medium=' + UTM.medium, 'utm_campaign=' + UTM.campaign, 'utm_content=' + id, 'utm_term=' + term].join('&');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const telHref = (t) => 'tel:' + t.replace(/[^+\d]/g, '').replace(/^0/, '+82');
  const find = (key, lang) => D.ORG.find((o) => o.key === key && o.lang === lang);

  // layout = assets/email/sig/org/layout.json, base = 이미지 주소 앞부분(미리보기에서는 상대 경로)
  function html(o, layout, base) {
    const g = layout[o.key + '_' + o.lang], en = o.lang === 'en', id = o.key;
    const src = (part) => `${base == null ? SITE : base}assets/email/sig/org/${o.key}/${o.lang}_${part}.png?v=${VER}`;
    const card = utm(D.LINKS.landing, id, 'card');
    const img = (s, w, h, alt) => `<img src="${esc(s)}" width="${Math.round(w)}" height="${Math.round(h)}" alt="${esc(alt)}"` +
      (alt ? ` title="${esc(alt)}"` : '') + ' style="display:block;border:0;outline:none;width:100%;height:auto;">';
    const td = 'padding:0;line-height:0;font-size:0;';
    const pct = (w) => (w / W * 100).toFixed(3) + '%';
    const row = (cells) => `<tr><td style="${td}"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>${cells}</tr></table></td></tr>`;
    const cell = (w, href, s, h, alt) => `<td width="${pct(w)}" style="width:${pct(w)};${td}"><a href="${esc(href)}" target="_blank">${img(s, w, h, alt)}</a></td>`;
    const [tel, mail, web] = o.contact.map((c) => c[1]);
    const contact = [
      [telHref(tel), en ? `Call ${tel}` : `${tel} 전화 걸기`],
      ['mailto:' + mail, en ? `Email ${mail}` : `${mail}로 메일 쓰기`],
      [utm(D.LINKS.landing, id, en ? 'website' : 'homepage'), en ? 'Website: igt.or.kr' : '홈페이지: igt.or.kr']
    ].map(([href, alt], i) => cell(g.contact[i + 1] - g.contact[i], href, src('m' + (i + 1)), R3[1] - R3[0], alt)).join('');
    const buttons = o.buttons.map(([label, , url, term], i) =>
      cell(g.row[i + 1] - g.row[i], term ? utm(url, id, term) : url, src('r' + i), BOT - TOP, label)).join('') +
      cell(W - g.row[o.buttons.length], card, src('r' + o.buttons.length), BOT - TOP, en ? 'Institute for Green Transformation' : '녹색전환연구소');
    const alt = `${o.name}${o.title ? ' ' + o.title : ''}. ${o.sub}. ${en ? 'Tel' : '전화'} ${tel}, ${en ? 'Email' : '메일'} ${mail}`;
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;max-width:${W}px;border-collapse:collapse;">` +
      `<tr><td style="${td}"><a href="${esc(card)}" target="_blank">${img(src('a'), W, R3[0], alt)}</a></td></tr>` +
      row(contact) +
      `<tr><td style="${td}"><a href="${esc(card)}" target="_blank">${img(src('b'), W, TOP - R3[1], '')}</a></td></tr>` +
      row(buttons) +
      `<tr><td style="${td}">${img(src('bot'), W, H - BOT, '')}</td></tr></table>`;
  }

  // 이미지를 쓸 수 없는 곳을 위한 글자 서명
  function plain(o) {
    const en = o.lang === 'en', id = o.key;
    const addr = en ? '2F, 4 Jungnim-ro 7-gil, Jung-gu, Seoul, Republic of Korea' : '서울특별시 중구 중림로7길 4, 2층';
    const vision = o.vision || (en ? 'A good life for all, within a living planet' : '지구의 수용 한계 안에서 누구나 기초적인 삶을 누릴 수 있는 사회를 만듭니다.');
    return [`${o.name}${o.title ? ' | ' + o.title : ''}`, o.sub,
      `T ${o.contact[0][1]} | E ${o.contact[1][1]} | W igt.or.kr`, addr, vision, '',
      ...o.buttons.map(([label, , url, term]) => `${label} ${term ? utm(url, id, term) : url}`)].join('\n');
  }

  // 추적링크 시트('UTM코드 생성기' A~L열) 행
  function sheetRows(date) {
    const d = date || new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rows = [], seen = new Set();
    for (const o of D.ORG) {
      const items = [[o.lang === 'en' ? 'Website 칸·버튼(영문)' : '홈페이지 칸(국문)', D.LINKS.landing, o.lang === 'en' ? 'website' : 'homepage'], ['버튼 밖 서명 영역', D.LINKS.landing, 'card'],
        ...o.buttons.filter((b) => b[3]).map((b) => [`${b[0]} 버튼`, b[2], b[3]])];
      for (const [label, url, term] of items) {
        const k = o.key + term; if (seen.has(k)) continue; seen.add(k);
        rows.push([ymd, '메일서명 도구 자동생성', `기관 메일 서명 ${label} - ${o.email}`, url, UTM.campaign, UTM.source, UTM.medium, o.key, term, '', utm(url, o.key, term), '']);
      }
    }
    return rows;
  }

  const api = { VER, find, html, plain, sheetRows, utm };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.SigOrg = api;

  /* ---------- 페이지 동작 ---------- */
  const box = document.getElementById('orgSigs');
  if (!box) return;
  const docOf = (body, title) => `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title></head>\n<body style="margin:24px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">\n<!-- 서명 시작: 아래 표 전체를 복사해 메일 프로그램의 서명 칸에 붙여 넣습니다 -->\n${body}\n<!-- 서명 끝 -->\n</body></html>\n`;
  const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const msg = document.getElementById('orgStatus');
  const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? '#b42318' : ''; };
  let state = { key: 'office', lang: 'kr' }, layout = null;

  async function render() {
    layout = layout || await fetch('assets/email/sig/org/layout.json?v=' + VER).then((r) => r.json());
    // 후원 메일은 국문만 있다
    const hasEn = !!find(state.key, 'en');
    if (!hasEn) state.lang = 'kr';
    const enBtn = box.querySelector('[data-lang="en"]');
    enBtn.disabled = !hasEn; enBtn.title = hasEn ? '' : '후원 메일은 국문 서명만 씁니다.';
    const o = find(state.key, state.lang);
    document.getElementById('orgPreview').innerHTML = html(o, layout, '');
    document.getElementById('orgAddr').textContent = o.email;
    box.querySelectorAll('[data-key]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === state.key)));
    box.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
  }
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.key) { state.key = b.dataset.key; return render(); }
    if (b.dataset.lang) { state.lang = b.dataset.lang; return render(); }
    const o = find(state.key, state.lang), name = `메일서명_${o.email.split('@')[0]}_${o.lang === 'en' ? '영문' : '국문'}`;
    if (b.id === 'orgCopy') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html(o, layout)], { type: 'text/html' }), 'text/plain': new Blob([plain(o)], { type: 'text/plain' }) })]);
        say('서명을 복사했습니다. ' + o.email + ' 계정의 서명 칸에 붙여 넣으세요.');
      } catch (err) { say('복사하지 못했습니다. ‘HTML 내려받기’로 받은 파일을 브라우저로 열어 서명을 복사해 주세요.', true); }
    } else if (b.id === 'orgText') {
      try { await navigator.clipboard.writeText(plain(o)); say('글자 서명을 복사했습니다.'); } catch (err) { say('복사하지 못했습니다: ' + err.message, true); }
    } else if (b.id === 'orgHtml') {
      save(new Blob([docOf(html(o, layout), name)], { type: 'text/html' }), name + '.html');
    } else if (b.id === 'orgGam') {
      // GAM 일괄 적용용: html 파일만 (서명 표 그대로)
      save(new Blob([html(o, layout)], { type: 'text/html' }), `${o.key}_${o.lang}.html`);
      say(`gam user ${o.email} signature file ${o.key}_${o.lang}.html html 로 적용합니다.`);
    }
  });
  render().catch((err) => say('기관 서명을 불러오지 못했습니다: ' + err.message, true));
})(typeof window !== 'undefined' ? window : globalThis);
