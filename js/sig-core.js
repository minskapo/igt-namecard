// 메일 서명: 글자 구성, 링크, 서명 HTML, 일괄 적용 파일 (브라우저·Node 겸용)
(function (root) {
  const C = root.CardData || (typeof require !== 'undefined' ? require('./card-data.js') : null);

  const SITE = 'https://minskapo.github.io/igt-namecard/';
  const BASE = SITE + 'assets/email/sig/';
  const COMMON_VER = '20261112b';
  const OFFICE = { kr: '02-2135-1148', en: '+82-2-2135-1148' };
  const ORG_EN = 'Institute for Green Transformation';
  const SEP = '  |  ';

  const LINK = {
    landing: 'https://igt.or.kr/',
    donate: 'https://secure.donus.org/igt/pay/step1',
    newsletter: 'https://igtkorea.stibee.com/',
    linkedin: 'https://www.linkedin.com/in/igtkorea2013/'
  };
  // 버튼 순서는 공통 이미지(assets/email/sig/common/<lang>/)와 같아야 한다.
  const BUTTONS = {
    kr: [
      { key: 'donate', url: LINK.donate, alt: '후원하기: 녹색전환연구소 후원 페이지' },
      { key: 'newsletter', url: LINK.newsletter, alt: '뉴스레터: 녹색전환연구소 뉴스레터 구독' },
      { key: 'homepage', url: LINK.landing, alt: '홈페이지: 녹색전환연구소 웹사이트' }
    ],
    en: [
      { key: 'linkedin', url: LINK.linkedin, alt: 'LinkedIn: Institute for Green Transformation', noUtm: true },
      { key: 'website', url: LINK.landing, alt: 'Website: Institute for Green Transformation' }
    ]
  };

  const idOf = (p) => String(p.email || '').split('@')[0].trim().toLowerCase();

  // 연구소 GA4 추적링크 시트(UTM코드 생성기)의 규칙을 따른다.
  // 순서: source → medium → campaign → content → term (시트 K열 수식과 같음)
  // source=signature(설정 탭 소스 목록), medium=email, campaign=email_signature,
  // content=구성원 이메일 아이디(명함 QR과 같은 방식), term=누른 곳(donate·newsletter·homepage·website·card)
  const UTM = { source: 'signature', medium: 'email', campaign: 'email_signature' };
  function utm(url, id, term) {
    const q = ['utm_source=' + UTM.source, 'utm_medium=' + UTM.medium, 'utm_campaign=' + UTM.campaign,
      'utm_content=' + encodeURIComponent(id), 'utm_term=' + term].join('&');
    return url + (url.includes('?') ? '&' : '?') + q;
  }

  function phone(p, lang) {
    const d = String(p.mobile || '').replace(/\D/g, '');
    let parts;
    if (d.startsWith('02')) parts = d.length === 9 ? [d.slice(0, 2), d.slice(2, 5), d.slice(5)] : [d.slice(0, 2), d.slice(2, 6), d.slice(6)];
    else parts = d.length === 10 ? [d.slice(0, 3), d.slice(3, 6), d.slice(6)] : [d.slice(0, 3), d.slice(3, 7), d.slice(7)];
    parts = parts.filter(Boolean);
    if (!parts.length) return '';
    if (lang === 'en') { parts[0] = parts[0].replace(/^0/, ''); return '+82-' + parts.join('-'); }
    return parts.join('-');
  }

  // 영문 직함 줄 "Researcher, Climate Advocacy Team" → 직급·팀
  function splitTitleEn(p) {
    const t = String(p.titleEn || '').trim();
    const i = t.indexOf(', ');
    if (i < 0) return { job: t, team: '' };
    return { job: t.slice(0, i), team: t.slice(i + 2) };
  }

  // 서명 이미지에 들어가는 글자
  function lines(p, lang) {
    const email = String(p.email || '').trim();
    if (lang === 'en') {
      const t = splitTitleEn(p);
      return {
        name: p.nameEn || '', title: t.job,
        sub: t.team ? t.team + SEP + ORG_EN : ORG_EN,
        m: phone(p, 'en'), t: OFFICE.en, e: email
      };
    }
    return {
      name: p.name || '', title: p.titleKr || '',
      sub: [p.nameEn, p.titleEn].filter(Boolean).join(SEP),
      m: phone(p, 'kr'), t: OFFICE.kr, e: email
    };
  }

  function altText(p, lang) {
    const L = lines(p, lang);
    if (lang === 'en') {
      const t = splitTitleEn(p);
      return [L.name, [t.job, t.team].filter(Boolean).join(', '), ORG_EN].filter(Boolean).join(', ') +
        `. Mobile ${L.m}, Office ${L.t}, Email ${L.e}`;
    }
    return `${L.name}, ${L.title}, 녹색전환연구소. 휴대전화 ${L.m}, 사무실 ${L.t}, 이메일 ${L.e}`;
  }

  // 내용이 바뀌면 이미지 주소의 ?v= 값도 바뀌어 메일 프로그램의 캐시를 피한다.
  function fnv(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  const version = (p, lang) => fnv(JSON.stringify(lines(p, lang)));

  const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
  function newCode() {
    const b = new Uint8Array(12);
    (root.crypto || require('crypto').webcrypto).getRandomValues(b);
    return Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
  }
  const validCode = (c) => /^[a-z0-9]{8,32}$/.test(String(c || ''));

  // 사람별 이미지 조각: <lang>_a(이름·직함), <lang>_m1·m2·m3(휴대전화·사무실·메일 칸), <lang>_b(주소·비전)
  const PARTS = ['a', 'm1', 'm2', 'm3', 'b'];
  const partUrl = (p, lang, part) => `${BASE}${p.sigCode}/${lang}_${part}.png?v=${version(p, lang)}`;
  const topUrl = (p, lang) => partUrl(p, lang, 'a');
  const commonUrl = (lang, f) => `${BASE}common/${lang}/${f}?v=${COMMON_VER}`;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const telHref = (num) => 'tel:' + String(num || '').replace(/[^+\d]/g, '').replace(/^0/, '+82');

  // 서명 HTML. layout = common/layout.json, geom = SigRender.top()이 돌려준 연락처 칸 경계,
  // srcs = 이미지 주소를 바꿔 넣을 때(미리보기)
  function html(p, lang, layout, geom, srcs) {
    const L = layout[lang], id = idOf(p), T = lines(p, lang);
    const part = (k) => (srcs && srcs.part ? srcs.part(k) : partUrl(p, lang, k));
    const common = (f) => (srcs && srcs.common ? srcs.common(f) : commonUrl(lang, f));
    const card = utm(LINK.landing, id, 'card');
    const img = (src, w, h, alt) => `<img src="${esc(src)}" width="${Math.round(w)}" height="${Math.round(h)}" alt="${esc(alt)}"` +
      (alt ? ` title="${esc(alt)}"` : '') + ' style="display:block;border:0;outline:none;width:100%;height:auto;">';
    const td = 'padding:0;line-height:0;font-size:0;';
    const pct = (w) => (w / L.W * 100).toFixed(3) + '%';
    const row = (cells) => `<tr><td style="${td}"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>${cells}</tr></table></td></tr>`;
    const cell = (w, href, src, h, alt) => `<td width="${pct(w)}" style="width:${pct(w)};${td}"><a href="${esc(href)}" target="_blank">${img(src, w, h, alt)}</a></td>`;
    const [y0, y1] = L.r3, xs = [0, geom.cut[0], geom.cut[1], L.W], mh = y1 - y0;
    const en = lang === 'en';
    const contact = [
      [telHref(T.m), en ? `Call mobile ${T.m}` : `휴대전화 ${T.m} 전화 걸기`],
      [telHref(T.t), en ? `Call office ${T.t}` : `사무실 ${T.t} 전화 걸기`],
      ['mailto:' + T.e, en ? `Email ${T.e}` : `${T.e}로 메일 쓰기`]
    ].map(([href, alt], i) => cell(xs[i + 1] - xs[i], href, part('m' + (i + 1)), mh, alt)).join('');
    const buttons = L.cells.map((c) => {
      const b = c.btn === null ? null : BUTTONS[lang][c.btn];
      const href = b ? (b.noUtm ? b.url : utm(b.url, id, b.key)) : card;
      return cell(c.w, href, common(c.f), L.bot - L.top, b ? b.alt : '');
    }).join('');
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;max-width:${L.W}px;border-collapse:collapse;">` +
      `<tr><td style="${td}"><a href="${esc(card)}" target="_blank">${img(part('a'), L.W, y0, altText(p, lang))}</a></td></tr>` +
      row(contact) +
      `<tr><td style="${td}"><a href="${esc(card)}" target="_blank">${img(part('b'), L.W, L.top - y1, '')}</a></td></tr>` +
      row(buttons) +
      `<tr><td style="${td}">${img(common('bot.png'), L.W, L.H - L.bot, '')}</td></tr></table>`;
  }

  // 이미지를 쓸 수 없는 곳을 위한 글자 서명
  function plain(p, lang) {
    const L = lines(p, lang), id = idOf(p);
    if (lang === 'en') {
      const t = splitTitleEn(p);
      return ['--', `${L.name} | ${[t.job, t.team].filter(Boolean).join(', ')}`, ORG_EN,
        `M ${L.m} | T ${L.t} | E ${L.e}`, '2F, 4 Jungnim-ro 7-gil, Jung-gu, Seoul, Republic of Korea',
        'A good life for all, within a living planet', '',
        'LinkedIn ' + LINK.linkedin, 'Website ' + utm(LINK.landing, id, 'website')].join('\n');
    }
    return ['--', `${L.name} | ${L.title}`, '녹색전환연구소 (Institute for Green Transformation)',
      `M ${L.m} | T ${L.t} | E ${L.e}`, '서울특별시 중구 중림로7길 4, 2층',
      '지구의 수용 한계 안에서 누구나 기초적인 삶을 누릴 수 있는 사회를 만듭니다.', '',
      '후원하기 ' + utm(LINK.donate, id, 'donate'), '뉴스레터 ' + utm(LINK.newsletter, id, 'newsletter'),
      '홈페이지 ' + utm(LINK.landing, id, 'homepage')].join('\n');
  }

  // 필수 값 확인
  function problems(p) {
    const out = [];
    if (!p.name) out.push('이름');
    if (!p.nameEn) out.push('영문 이름');
    if (!/^[^\s@]+@igt\.or\.kr$/i.test(String(p.email || '').trim())) out.push('@igt.or.kr 이메일');
    if (!phone(p, 'kr')) out.push('휴대전화');
    if (!p.titleKr) out.push('국문 직함');
    if (!p.titleEn) out.push('영문 직함');
    return out;
  }

  // 연구소 추적링크 시트('UTM코드 생성기' 탭 A~L열)에 붙여 넣을 행 (사람당 5줄, 명함생성기와 같은 형식)
  const SHEET_ROWS = [
    ['후원하기 버튼(국문)', LINK.donate, 'donate'],
    ['뉴스레터 버튼(국문)', LINK.newsletter, 'newsletter'],
    ['홈페이지 버튼(국문)', LINK.landing, 'homepage'],
    ['Website 버튼(영문)', LINK.landing, 'website'],
    ['버튼 밖 서명 영역', LINK.landing, 'card']
  ];
  function sheetRows(p, date) {
    const d = date || new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = idOf(p), role = p.titleKr ? ` (${p.titleKr})` : '';
    return SHEET_ROWS.map(([label, url, term]) => [ymd, '메일서명 도구 자동생성', `메일 서명 ${label} - ${p.name}${role}`,
      url, UTM.campaign, UTM.source, UTM.medium, id, term, '', utm(url, id, term), '']);
  }

  const api = { UTM, sheetRows, PARTS, partUrl, telHref, SITE, BASE, COMMON_VER, LINK, BUTTONS, idOf, utm, phone, lines, altText, version, newCode, validCode, topUrl, commonUrl, html, plain, problems, splitTitleEn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SigCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
