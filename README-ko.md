# OpenRoute

OpenRoute는 사용자 제보와 지도 기반 경로 탐색을 활용해 접근성 장애물(계단, 통행 방해 구간, 엘리베이터 이슈 등)을 피할 수 있도록 돕는 모바일 내비게이션 앱입니다.

## 소개하기 앞서..

> 이 문서는 [한국어 문서](/README-ko.md)를 기반으로 AI를 활용하여 번역한 내용입니다.
> 만약 두 문서간 충돌이 있을 경우 [한국어 문서](/README-ko.md)를 우선으로 합니다.

## 프로젝트 소개

> 이 프로젝트는 [grizzly-hacks-ii 해커톤](https://grizzly-hacks-ii.devpost.com/)를 위해 제작되었습니다.
> 이 프로젝트는 팀 BSD(Better Software Development, [이준성](https://junx.dev/) (팀장), 전재민, 박한결, 이주원)에 의해 작성되었습니다.
> 이 레포지토리의 모든 저작물에 대한 저작권은 팀 BSD(Better Software Development)에 있습니다. (자세한 내용은 [LICENSE](/LICENSE)를 확인하세요)
> 이 레포지토리는 팀 BSD에 의해 관리됩니다.

## OpenRoute 소개

- 보행 경로를 탐색하고 경로 위의 제보 장애물을 표시합니다.
- 장소 검색(자동완성 + 상세 조회)을 지원합니다.
- 사진 업로드와 함께 신규 장애물 제보가 가능합니다.
- FastAPI 기반 타일 프록시로 지도 타일을 제공합니다.

## 기술 스택

- 클라이언트: Expo + React Native
- 서버: FastAPI (Python)
- 데이터베이스: SQLite
- 외부 API: Google Maps Tiles, Places, Directions, OAuth

## 프로젝트 노션 (한국어로 작성됨)

https://www.notion.so/Devpost-Hackaton-30e3a23b48228055bb33d9ab99aa22a8

## 저장소 구조

```text
.
|-- client/   # Expo React Native 앱
`-- server/   # FastAPI API + SQLite 로직
```

## 빠른 시작

### 1) 서버 실행

```bash
cd server
python -m pip install -r requirements.txt
python main.py
```

필수 환경 변수:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

선택 환경 변수 (Google 로그인 사용 시):

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:8000/callback/google
```

### 2) 클라이언트 실행

```bash
cd client
npm install
npm run start
```

자주 쓰는 명령어:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`

## 주요 API 엔드포인트

- `GET /health`
- `GET /maps/tiles/{z}/{x}/{y}.png`
- `POST /places/search/text`
- `GET /places/autocomplete`
- `POST /directions/walking`
- `POST /warning/add_place`

## 참고 사항

- 장애물 제보와 사용자 데이터는 SQLite(`app.db`)에 저장됩니다.
- 대중교통 탭은 현재 플레이스홀더 상태입니다.
- 해커톤 단계의 프로젝트로, 계속 개선 중입니다.

## 라이선스

MIT 라이선스입니다. 자세한 내용은 `LICENSE`를 참고하세요.

## BSD 팀원에게 
애들아 수고했다 우승 가자 - 이준성