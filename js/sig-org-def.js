// 기관 메일 서명(공식 office@·후원 donate@) 정의. 이미지는 tools/sig-org-render로 미리 만들어 assets/email/sig/org/에 둔다.
(function (root) {
  const DONUS = { join: 'https://secure.donus.org/igt/pay/step1', mypage: 'https://secure.donus.org/igt/mypage/login' };
  const L = {
    landing: 'https://igt.or.kr/', donate: 'https://igt.or.kr/project2030/', contact: 'https://igt.or.kr/contact/',
    newsletter: 'https://igtkorea.stibee.com/',
    linkedin: 'https://www.linkedin.com/company/institute-for-green-transformation/home/'
  };
  const TEL = { kr: '02-2135-1148', en: '+82-2-2135-1148' };
  // btn: [글자, 채움 여부, 링크, utm_term(null이면 UTM을 붙이지 않음)]
  const ORG = [
    { key: 'office', email: 'office@igt.or.kr', label: '연구소 공식 메일', lang: 'kr',
      name: '사단법인 녹색전환연구소', title: '', sub: 'Institute for Green Transformation',
      buttons: [['후원하기', true, L.donate, 'donate'], ['뉴스레터', false, L.newsletter, 'newsletter'], ['문의·강의 요청', false, L.contact, 'contact']] },
    { key: 'donate', email: 'donate@igt.or.kr', label: '후원 전용 메일', lang: 'kr',
      name: '사단법인 녹색전환연구소', title: '후원회원 지원', sub: '후원 신청·정보 변경, 기부금 영수증 발급을 도와드립니다.',
      vision: '여러분의 후원이 녹색전환의 길을 엽니다. 늘 함께해 주셔서 고맙습니다.',
      buttons: [['후원회원 가입', true, DONUS.join, null], ['마이페이지', false, DONUS.mypage, null], ['후원 안내', false, L.donate, 'donate']] },
    { key: 'office', email: 'office@igt.or.kr', label: 'Official (EN)', lang: 'en',
      name: 'Institute for Green Transformation', title: '', sub: 'IGT  |  Non-profit research institute, Seoul',
      buttons: [['LinkedIn', true, L.linkedin, null], ['Website', false, L.landing, 'website'], ['Contact', false, L.contact, 'contact']] },
    { key: 'donate', email: 'donate@igt.or.kr', label: 'Donor support (EN)', lang: 'en',
      name: 'Institute for Green Transformation', title: 'Donor Support', sub: 'Membership sign-up and changes, donation receipts',
      vision: 'Thank you for standing with us for a green transformation.',
      buttons: [['Donate', true, DONUS.join, null], ['My Page', false, DONUS.mypage, null], ['Website', false, L.landing, 'website']] }
  ];
  ORG.forEach((o) => { o.contact = [['T', TEL[o.lang]], ['E', o.email], ['W', 'igt.or.kr']]; });
  const api = { ORG, LINKS: L, DONUS, TEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SigOrgDef = api;
})(typeof window !== 'undefined' ? window : globalThis);
