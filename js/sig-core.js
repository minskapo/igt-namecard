// 메일 서명: 글자 구성, 링크, 서명 HTML, 일괄 적용 파일 (브라우저·Node 겸용)
(function (root) {
  const C = root.CardData || (typeof require !== 'undefined' ? require('./card-data.js') : null);

  const SITE = 'https://minskapo.github.io/igt-namecard/';
  const BASE = SITE + 'assets/email/sig/';
  const COMMON_VER = '20261111';
  const OFFICE = { kr: '02-2135-1148', en: '+82-2-2135-1148' };
  const ORG_EN = 'Institute for Green Transformation';
  const SEP = '  |  ';

  const LINK = {
    landing: 'https://igt.or.kr/',
    donate: 'https://secure.donus.org/igt/pay',
    newsletter: 'https://igtkorea.stibee.com/subscribe/',
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

  function utm(url, id, term) {
    const q = ['utm_source=email', 'utm_medium=signature', 'utm_campaign=email_signature',
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

  const topUrl = (p, lang) => `${BASE}${p.sigCode}/${lang}.png?v=${version(p, lang)}`;
  const commonUrl = (lang, f) => `${BASE}common/${lang}/${f}?v=${COMMON_VER}`;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // 서명 HTML. layout = assets/email/sig/common/layout.json, srcs = 이미지 주소를 바꿔 넣을 때(미리보기)
  function html(p, lang, layout, srcs) {
    const L = layout[lang], id = idOf(p);
    const top = srcs ? srcs.top : topUrl(p, lang);
    const common = (f) => (srcs && srcs.common ? srcs.common(f) : commonUrl(lang, f));
    const card = utm(LINK.landing, id, 'card');
    const img = (src, w, h, alt) => `<img src="${esc(src)}" width="${w}" height="${h}" alt="${esc(alt)}"` +
      (alt ? ` title="${esc(alt)}"` : '') + ' style="display:block;border:0;outline:none;width:100%;height:auto;">';
    const td = 'padding:0;line-height:0;font-size:0;';
    const cells = L.cells.map((c) => {
      const b = c.btn === null ? null : BUTTONS[lang][c.btn];
      const href = b ? (b.noUtm ? b.url : utm(b.url, id, b.key)) : card;
      const pct = (c.w / L.W * 100).toFixed(3);
      return `<td width="${pct}%" style="width:${pct}%;${td}"><a href="${esc(href)}" target="_blank">${img(common(c.f), c.w, L.bot - L.top, b ? b.alt : '')}</a></td>`;
    }).join('');
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;max-width:${L.W}px;border-collapse:collapse;">` +
      `<tr><td style="${td}"><a href="${esc(card)}" target="_blank">${img(top, L.W, L.top, altText(p, lang))}</a></td></tr>` +
      `<tr><td style="${td}"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>${cells}</tr></table></td></tr>` +
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

  const api = { SITE, BASE, COMMON_VER, LINK, BUTTONS, idOf, utm, phone, lines, altText, version, newCode, validCode, topUrl, commonUrl, html, plain, problems, splitTitleEn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SigCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
