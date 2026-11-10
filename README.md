# 녹색전환연구소 명함 생성기

연락처 엑셀(`운영_연구소 구성원 연락처인쇄용_*.xlsx`)을 불러와 이름을 고르면 명함 앞·뒷면을 미리 보고, 인쇄발주용 파일(PDF 호환 `.ai`)을 내려받을 수 있는 정적 웹페이지입니다.

- 엑셀은 브라우저 안에서만 읽히며 어디에도 업로드·저장되지 않습니다. 저장소에는 구성원 개인정보가 없습니다.
- 신규 입사자는 ‘신규 입사자 직접 입력’으로 만들 수 있습니다.
- 출력 규격: 대지 90×50mm + 문서 도련 2mm(페이지 94×54mm), 단위 mm, 94×54(도련선)·90×50(재단선) 투명 박스(칠·선 없음) 포함, 앞면 PANTONE 909 C 별색, 뒷면 K100(재단선 테두리 없음, QR은 벡터), 서체 Asta Sans SemiBold 전체 임베드.
- 사람마다 앞면·뒷면 2쪽(=아트보드 2개)으로 이어집니다.
- 내려받기: 인쇄발주용 AI(글자 아웃라인, Illustrator 편집 데이터 포함 → 아트보드마다 레이어 1개·그룹 1개로 열림), PNG(재단 90×50mm·600dpi 앞·뒷면). 여러 명이면 사람별 파일을 ZIP으로 묶습니다.

## QR 추적 링크
- QR에는 구성원별 UTM 링크를 [da.gd](https://da.gd)로 줄인 단축링크가 들어갑니다. 규칙은 ‘녹색전환연구소 GA4 추적링크 생성기’ 시트를 따릅니다.
  - 랜딩 `https://igt.or.kr/` · `utm_source=bizcard` · `utm_medium=qrcode` · `utm_campaign=business_card` · `utm_content=<이메일 아이디>`
- 단축 코드는 UTM 링크에서 해시로 정해지므로(`igt` + 7자), 같은 사람은 몇 번을 만들어도 같은 단축링크가 나옵니다. 이미 있으면 새로 만들지 않고 재사용합니다.
- GA4에서는 소스/매체 `bizcard / qrcode`, 캠페인 `business_card`, 콘텐츠(이메일 아이디)로 구성원별 유입을 볼 수 있습니다.
- 신규 발급자는 페이지의 ‘시트에 붙여넣을 행 복사’로 시트 A~L열 형식의 행을 복사해 붙여넣습니다.
- 규칙을 바꾸려면 `js/card-link.js`의 `LINK` 값을 고칩니다. 값이 바뀌면 단축링크도 새로 만들어집니다.

## 인쇄 주문 (강프린팅)
- 강프린팅 강원경 실장님 010-8863-7226 · http://www.kangprinting.com/
- 사양: 엑스트라누보 350g · 양면칼라 · 90×50mm. 인쇄발주용 AI(사람별 파일)를 보내 발주합니다.

## 구성
- `assets/base.pdf`: 원본 `녹색전환연구소 명함_별색_9050.ai`에서 Illustrator 전용 데이터와 뒷면 가변 텍스트를 걷어낸 바탕 템플릿
- `assets/AstaSans-SemiBold.ttf`: Asta Sans 가변 폰트(SIL OFL)의 SemiBold 정적 인스턴스
- `js/card-data.js`: 엑셀 파싱, 로마자 표기, 직함 영문화 규칙 (`TEAM_EN`, `TITLE_EN`에서 수정)
- `js/card-link.js`: UTM 링크 조립(시트 K열 수식과 같은 순서), da.gd 단축링크 생성·재사용, 시트용 행 생성
- `js/card-ai.js`, `js/card-ai-data.js`: Illustrator 편집 데이터(AI private data, %AI24_ZStandard_Data 컨테이너) 생성. 아트보드=재단 90×50, 문서 도련 2mm, 단위 mm(Illustrator 30.8.2에서 아트보드·레이어·그룹·도련 유지 확인), 앞·뒷면 고정 아트는 VectorCraft로 원본 템플릿을 변환해 추출한 조각을 씀
- `js/card-pdf.js`: 좌표·서체 크기·자간(트래킹 -20) 등 레이아웃과 PDF 생성
- `vendor/`: qrcode-generator 1.4.4, JSZip 3.10.1, pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1, SheetJS 0.18.5, pdf.js 3.11.174

## 참고
- Illustrator에서 열면 PDF 가져오기 대화상자가 뜰 수 있습니다. 인쇄소에는 그대로 넘기면 됩니다.
- 팀명이 바뀌거나 새 팀이 생기면 `js/card-data.js`의 `TEAM_EN`에 영문명을 추가하세요.

- 내용 수정은 연락처 엑셀 또는 페이지 ③에서 하고 다시 내려받습니다. 글자 편집용 AI는 서체 대체 문제로 제공하지 않습니다.
