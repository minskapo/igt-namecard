// 명함 QR용 추적 링크: UTM 링크 생성(GA4 추적링크 생성기 시트 규칙) + da.gd 단축링크 자동 생성
(function (root) {
  // 'UTM코드 생성기' 시트 규칙: 랜딩/캠페인/소스(설정 시트 목록)/매체(설정 시트 목록)/콘텐츠
  const LINK = {
    landing: 'https://igt.or.kr/',
    campaign: 'business_card',
    source: 'bizcard',
    medium: 'qrcode',
    shortener: 'https://da.gd'
  };

  // 구성원 구분값(utm_content): 이메일 아이디. 없으면 영문 이름으로 대체
  function contentId(p) {
    const local = String(p.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (local) return local;
    return String(p.nameEn || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
  }

  // 시트 K열 수식과 같은 순서·인코딩(ENCODEURL)으로 조립
  function utmUrl(p) {
    const id = contentId(p);
    if (!id) return '';
    const enc = encodeURIComponent;
    const base = LINK.landing.trim();
    return base + (base.includes('?') ? '&' : '?') +
      'utm_source=' + enc(LINK.source) +
      '&utm_medium=' + enc(LINK.medium) +
      '&utm_campaign=' + enc(LINK.campaign) +
      '&utm_content=' + enc(id);
  }

  // 같은 UTM 링크에는 항상 같은 단축 코드가 나오도록 해시로 코드 생성 (da.gd 사용자 지정 코드는 10자 제한)
  function slugFor(url, salt) {
    let h = 0x811c9dc5;
    const s = url + (salt ? '#' + salt : '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'igt' + h.toString(36).padStart(7, '0').slice(-7);
  }

  // 이미 만들어 둔 코드가 있으면 재사용, 없으면 생성. 다른 주소가 쓰고 있으면 다음 코드로.
  async function ensureShort(url, fetchFn) {
    const f = fetchFn || fetch;
    for (let salt = 0; salt < 4; salt++) {
      const slug = slugFor(url, salt);
      const look = await f(`${LINK.shortener}/coshorten/${slug}`);
      if (look.status === 200) {
        const target = (await look.text()).trim();
        if (target === url) return `${LINK.shortener}/${slug}`;
        continue;
      }
      const res = await f(`${LINK.shortener}/s?url=${encodeURIComponent(url)}&shorturl=${slug}`);
      const body = (await res.text()).trim();
      if (res.status === 200 && body.startsWith(LINK.shortener + '/')) return body;
      if (res.status === 400 && /taken/i.test(body)) continue;
      throw new Error('단축링크 생성 실패: ' + body.slice(0, 120));
    }
    throw new Error('단축 코드가 계속 겹칩니다.');
  }

  // 'UTM코드 생성기' 시트 A~L열 한 행 (K열은 시트 수식과 같은 결과값)
  const AUTHOR = '명함생성기 자동생성'; // 시트 B열(작성자)
  function sheetRow(p, shortUrl, date) {
    const d = date || new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const role = [p.titleKr].filter(Boolean).join(' ');
    return [ymd, AUTHOR, `명함 QR코드 - ${p.name}${role ? ' (' + role + ')' : ''}`, LINK.landing,
      LINK.campaign, LINK.source, LINK.medium, contentId(p), '', '', utmUrl(p), shortUrl || ''];
  }

  const api = { LINK, contentId, utmUrl, slugFor, ensureShort, sheetRow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CardLink = api;
})(typeof window !== 'undefined' ? window : globalThis);
