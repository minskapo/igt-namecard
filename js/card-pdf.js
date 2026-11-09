// 인쇄용 PDF(=PDF 호환 .ai) 생성기. pdf-lib + fontkit 사용 (브라우저·Node 겸용)
(function (root) {
  const LIB = () => (typeof PDFLib !== 'undefined' ? PDFLib : require('pdf-lib'));

  // 템플릿(녹색전환연구소 명함_별색_9050.ai, 2026-11-09) 뒷면 좌표, 단위 pt, 재단선 바깥 2mm 도련 포함 페이지 기준
  // 영문 직함은 2줄 자리를 확보한 배치: 한 줄에 들어가면 1줄, 넘치면 직급/팀명으로 나눠 2줄(행간 1.2em)
  const L = {
    left: 14.1733, right: 95.8496,
    name:    { y: 131.8047, size: 8.5, track: 0 },
    titleKr: { y: 132.0186, size: 7.8, track: -20 },
    nameEn:  { y: 121.2344, size: 7.8, track: 0 },
    titleEn: { y: 121.2344, size: 7.8, track: -20, leading: 9.36, maxWidth: 150 },
    rows: [
      { label: 'MOBILE',  key: 'mobile',  y: 86.5957 },
      { label: 'TEL',     key: 'tel',     y: 75.333 },
      { label: 'E-MAIL',  key: 'email',   y: 64.0703 },
      { label: 'ADDRESS', key: 'address', y: 52.8076, valueY: 53.1406, valueSize: 7.2 }
    ],
    rowSize: 7.5, rowTrack: -20
  };

  function makeTextTools(doc, font) {
    const { PDFOperator, PDFNumber } = LIB();
    const fk = font.embedder.font;
    const upm = fk.unitsPerEm;

    // 글자 단위 인코딩 + 폰트 커닝 반영 (합자 비활성: 이메일 'fi' 등 방지)
    function measure(text, size, track) {
      const run = fk.layout(text, { liga: false, clig: false, dlig: false });
      let w = 0;
      run.positions.forEach((p, i) => { w += p.xAdvance; if (i < run.positions.length - 1) w += track * upm / 1000; });
      return { run, width: w / upm * size };
    }
    function textOps(key, text, x, y, size, track) {
      if (!text) return [];
      const chars = Array.from(text);
      const { run } = measure(text, size, track);
      const sameLen = run.glyphs.length === chars.length;
      const arr = doc.context.obj([]);
      chars.forEach((ch, i) => {
        arr.push(font.encodeText(ch));
        if (sameLen && i < chars.length - 1) {
          const g = run.glyphs[i], p = run.positions[i];
          const kern = (p.xAdvance - g.advanceWidth) * 1000 / upm; // 음수=당김
          if (Math.abs(kern) > 0.01) arr.push(PDFNumber.of(-kern));
        }
      });
      return [
        PDFOperator.of('BT'),
        PDFOperator.of('Tf', [key, PDFNumber.of(size)]),
        PDFOperator.of('Tc', [PDFNumber.of(track / 1000 * size)]),
        PDFOperator.of('Td', [PDFNumber.of(x), PDFNumber.of(y)]),
        PDFOperator.of('TJ', [arr]),
        PDFOperator.of('ET')
      ];
    }
    return { measure, textOps };
  }

  function titleEnLines(tools, text) {
    const t = L.titleEn;
    if (!text) return [];
    if (tools.measure(text, t.size, t.track).width <= t.maxWidth || !text.includes(', ')) return [text];
    const k = text.indexOf(', ');
    return [text.slice(0, k + 1), text.slice(k + 2)];
  }

  async function drawBack(doc, page, font, p) {
    const { PDFOperator, PDFNumber, PDFName } = LIB();
    const tools = makeTextTools(doc, font);
    // 폰트를 페이지 리소스에 등록
    const key = page.node.newFontDictionary(font.name, font.ref);
    const ops = [PDFOperator.of('q'), PDFOperator.of('k', [0, 0, 0, 1].map((v) => PDFNumber.of(v)))];
    const add = (t, x, y, size, track) => ops.push(...tools.textOps(key, t, x, y, size, track));
    add(p.name, L.left, L.name.y, L.name.size, L.name.track);
    add(p.titleKr, L.right, L.titleKr.y, L.titleKr.size, L.titleKr.track);
    add(p.nameEn, L.left, L.nameEn.y, L.nameEn.size, L.nameEn.track);
    titleEnLines(tools, p.titleEn).forEach((line, i) =>
      add(line, L.right, L.titleEn.y - i * L.titleEn.leading, L.titleEn.size, L.titleEn.track));
    L.rows.forEach((r) => {
      add(r.label, L.left, r.y, L.rowSize, L.rowTrack);
      add(p[r.key], L.right, r.valueY || r.y, r.valueSize || L.rowSize, L.rowTrack);
    });
    ops.push(PDFOperator.of('Q'));
    page.pushOperators(...ops);
  }

  // people: [{name,titleKr,nameEn,titleEn,mobile,tel,email,address}] → Uint8Array (PDF 1.6, .ai로 저장 가능)
  async function buildCards(baseBytes, fontBytes, people, fontkitLib) {
    const { PDFDocument } = LIB();
    const base = await PDFDocument.load(baseBytes);
    const out = await PDFDocument.create();
    out.registerFontkit(fontkitLib);
    const font = await out.embedFont(fontBytes, { subset: false });
    // 한 번에 복사해야 ICC 프로필·로고 등 공통 리소스가 한 벌만 들어감
    const pages = await out.copyPages(base, people.flatMap(() => [0, 1]));
    for (const [i, p] of people.entries()) {
      const front = pages[i * 2], back = pages[i * 2 + 1];
      out.addPage(front);
      out.addPage(back);
      await drawBack(out, back, font, p);
    }
    const names = people.map((p) => p.name).join(', ');
    out.setTitle('녹색전환연구소 명함 – ' + names);
    out.setCreator('IGT 명함 생성기');
    out.setProducer('IGT 명함 생성기 (pdf-lib)');
    return out.save({ useObjectStreams: false });
  }

  const api = { buildCards, LAYOUT: L };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CardPDF = api;
})(typeof window !== 'undefined' ? window : globalThis);
