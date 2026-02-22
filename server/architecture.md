# API 명세서

## Base URL
- 개발: `http://localhost:8000`
- 프로덕션: `https://devpost.junx.dev`

---

## 인증 (Auth)

### Google 로그인
```
GET /auth/google
```
Google OAuth 로그인 페이지로 리다이렉트합니다.

#### Response
- `302 Redirect` → Google 로그인 페이지

---

### Google 콜백
```
GET /callback/google
```
Google OAuth 콜백을 처리하고 사용자를 생성하거나 로그인합니다.

#### Query Parameters
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| code | string | O | Google에서 발급한 인가 코드 |
| state | string | O | CSRF 방지용 상태값 |

#### Response (200 OK)
```json
{
    "message": "Login successful",
    "user": {
        "id": 1,
        "username": "홍길동",
        "email": "user@gmail.com",
        "google_id": "123456789",
        "profile_image": "https://...",
        "obstacles_reported": 0,
        "photos_uploaded": 0,
        "verifications": 0,
        "created_at": "2024-01-01 12:00:00"
    },
    "access_token": "ya29.xxx..."
}
```

---

### 현재 사용자 조회
```
GET /auth/me
```
현재 로그인한 사용자 정보를 조회합니다.

#### Headers
| 헤더 | 값 |
|-----|-----|
| Authorization | Bearer {access_token} |

#### Response (200 OK)
```json
{
    "user": {
        "id": 1,
        "username": "홍길동",
        "email": "user@gmail.com",
        "google_id": "123456789",
        "profile_image": "https://...",
        "obstacles_reported": 5,
        "photos_uploaded": 3,
        "verifications": 2,
        "created_at": "2024-01-01 12:00:00"
    },
    "badges": [
        {"badge_name": "First Reporter", "earned_at": "2024-01-02 10:00:00"}
    ]
}
```

#### Error Response
- `401 Unauthorized`: 토큰이 없거나 유효하지 않음

---

## 장애물 제보 (Warning)

### 지도 뷰포트 내 접근성 정보 조회
```
POST /warning/viewport
```
지도에서 보이는 영역(바운딩 박스) 내의 모든 접근성 정보를 조회합니다.

#### Request Body
```json
{
    "sw_latitude": 37.5600,
    "sw_longitude": 126.9700,
    "ne_latitude": 37.5700,
    "ne_longitude": 126.9900,
    "type": "Stair"
}
```

| 필드 | 타입 | 필수 | 설명 |
|-----|------|------|------|
| sw_latitude | float | O | 남서쪽 위도 |
| sw_longitude | float | O | 남서쪽 경도 |
| ne_latitude | float | O | 북동쪽 위도 |
| ne_longitude | float | O | 북동쪽 경도 |
| type | string | X | 필터: `Stuff`, `Stair`, `EV` (없으면 전체) |

#### Response (200 OK)
```json
{
    "message": "Places retrieved successfully",
    "stats": {
        "total": 15,
        "Stuff": 8,
        "Stair": 4,
        "EV": 3
    },
    "places": [
        {
            "latitude": 37.5650,
            "longitude": 126.9800,
            "type": "Stair",
            "ids": [1, 5, 12]
        }
    ]
}
```

---

### 장애물 신고
```
POST /warning/add_place
```

#### Request Body
```json
{
    "user_id": 1,
    "name": "제보 이름",
    "latitude": 37.5665,
    "longitude": 126.9780,
    "description": "제보 내용",
    "type": "Stuff"
}
```

| 필드 | 타입 | 필수 | 설명 |
|-----|------|------|------|
| user_id | int | O | 사용자 ID |
| name | string | O | 제보 이름 |
| latitude | float | O | 위도 |
| longitude | float | O | 경도 |
| description | string | O | 제보 내용 |
| type | string | X | 타입: `Stuff`(기본), `Stair`, `EV` |

#### Response (200 OK)
```json
{
    "message": "Warning place added successfully",
    "id": 1
}
```

---

### 장애물 이미지 업로드
```
POST /warning/update_place_img/{place_id}
```

#### Headers
| 헤더 | 값 |
|-----|-----|
| Content-Type | image/png |

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| place_id | int | 장애물 고유 ID |

#### Request Body
- PNG 이미지 파일 (multipart/form-data)

#### Response (200 OK)
```json
{
    "message": "Warning place image updated successfully"
}
```

#### Error Response
- `404 Not Found`: 장애물을 찾을 수 없음
- `415 Unsupported Media Type`: PNG 파일이 아님
- `400 Bad Request`: 유효하지 않은 이미지 형식

---

### 범위 내 장애물 조회
```
POST /warning/get_place/
```
출발지와 도착지 사이의 장애물을 조회합니다. (±0.001 범위)

#### Request Body
```json
{
    "origin_latitude": 37.5665,
    "origin_longitude": 126.9780,
    "destination_latitude": 37.5700,
    "destination_longitude": 126.9800
}
```

#### Response (200 OK)
```json
{
    "message": "Warning places fetched successfully",
    "list": [
        {
            "id": 1,
            "user_id": 1,
            "name": "장애물 이름",
            "latitude": 37.5670,
            "longitude": 126.9785,
            "description": "장애물 설명",
            "type": "Stuff",
            "has_image": 1,
            "verification_count": 5,
            "created_at": "2024-01-01 12:00:00",
            "updated_at": "2024-01-01 12:30:00"
        }
    ]
}
```

---

### 특정 장애물 조회
```
GET /warning/get_place/{place_id}
```

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| place_id | int | 장애물 고유 ID |

#### Response (200 OK)
```json
{
    "message": "Warning place retrieved successfully",
    "place": {
        "id": 1,
        "user_id": 1,
        "name": "장애물 이름",
        "latitude": 37.5670,
        "longitude": 126.9785,
        "description": "장애물 설명",
        "type": "Stuff",
        "has_image": 1,
        "verification_count": 5,
        "created_at": "2024-01-01 12:00:00",
        "updated_at": "2024-01-01 12:30:00"
    }
}
```

#### Error Response
- `404 Not Found`: 장애물을 찾을 수 없음

---

### 장애물 이미지 조회
```
GET /warning/get_place_img/{place_id}
```

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| place_id | int | 장애물 고유 ID |

#### Response (200 OK)
- Content-Type: `image/png`
- 이미지 바이너리 데이터

#### Error Response
- `404 Not Found`: 이미지를 찾을 수 없음

---

### 장애물 검증
```
POST /warning/verify/{place_id}
```
다른 사용자가 신고한 장애물이 실제로 존재하는지 검증합니다.

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| place_id | int | 장애물 고유 ID |

#### Request Body
```json
{
    "user_id": 2,
    "is_valid": true
}
```

#### Response (200 OK)
```json
{
    "message": "Verification submitted successfully",
    "place_id": 1,
    "is_valid": true
}
```

#### Error Response
- `400 Bad Request`: 본인이 신고한 장애물 검증 불가
- `400 Bad Request`: 이미 검증한 장애물
- `404 Not Found`: 장애물을 찾을 수 없음

---

### 장애물 검증 내역 조회
```
GET /warning/verifications/{place_id}
```

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| place_id | int | 장애물 고유 ID |

#### Response (200 OK)
```json
{
    "place_id": 1,
    "verification_count": 5,
    "verifications": [
        {
            "id": 1,
            "user_id": 2,
            "username": "검증자",
            "is_valid": 1,
            "created_at": "2024-01-02 10:00:00"
        }
    ]
}
```

#### Error Response
- `404 Not Found`: 장애물을 찾을 수 없음

---

## 사용자 & 뱃지 (Badge)

### 사용자 생성
```
POST /badge/user
```

#### Request Body
```json
{
    "username": "사용자명"
}
```

#### Response (200 OK)
```json
{
    "message": "User created successfully",
    "id": 1
}
```

#### Error Response
- `400 Bad Request`: 이미 존재하는 사용자명

---

### 사용자 조회
```
GET /badge/user/{user_id}
```

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| user_id | int | 사용자 ID |

#### Response (200 OK)
```json
{
    "user": {
        "id": 1,
        "username": "홍길동",
        "email": "user@gmail.com",
        "google_id": "123456789",
        "profile_image": "https://...",
        "obstacles_reported": 5,
        "photos_uploaded": 3,
        "verifications": 2,
        "created_at": "2024-01-01 12:00:00"
    },
    "badges": [
        {"badge_name": "First Reporter", "earned_at": "2024-01-02 10:00:00"},
        {"badge_name": "Photo Contributor", "earned_at": "2024-01-03 15:00:00"}
    ]
}
```

#### Error Response
- `404 Not Found`: 사용자를 찾을 수 없음

---

### 뱃지 평가
```
POST /badge/user/{user_id}/evaluate
```
사용자의 활동을 평가하여 새로운 뱃지를 부여합니다.

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| user_id | int | 사용자 ID |

#### Response (200 OK)
```json
{
    "new_badges": ["Explorer"],
    "all_badges": [
        {"badge_name": "First Reporter", "earned_at": "2024-01-02 10:00:00"},
        {"badge_name": "Explorer", "earned_at": "2024-01-05 09:00:00"}
    ]
}
```

---

## 뱃지 종류

| 뱃지명 | 설명 | 달성 조건 |
|-------|------|----------|
| 첫 발걸음 | OpenRoute에 오신 것을 환영해요! | OpenRoute 첫 가입 |
| 눈 밝은 시민 | 첫 접근성 정보를 제보했어요 | 처음으로 정보 제공 |
| 불꽃 튀는 루틴 | 7일 연속으로 제보를 이어갔어요 | 7일 연속 지역 정보 등록 |
| 길잡이 | 제보 10회를 달성했어요 | 지역 정보 등록 10회 달성 |
| 오늘은 내가 거리의 수호자 | 제보 30회를 달성했어요 | 지역 정보 등록 30회 달성 |
| 계단 스카우트 | 첫 계단 정보를 등록했어요 | 처음으로 계단 정보 등록 |
| 든든한 동행자 | 1년간 접근성 정보를 등록했어요 | OpenRoute 1년 가입 |
| 엘리베이터 가이드 | 첫 엘레베이터 정보를 등록했어요 | 처음으로 엘레베이터 정보 등록 |

### 뱃지 목록 조회
```
GET /badge/list
```

#### Response (200 OK)
```json
{
    "badges": [
        {"name": "첫 발걸음", "description": "OpenRoute에 오신 것을 환영해요!"},
        {"name": "눈 밝은 시민", "description": "첫 접근성 정보를 제보했어요"}
    ]
}
```

---

## 지도 타일 (Map Tiles)

Google Maps 타일을 프록시하여 클라이언트에 제공합니다. 서버 측 캐싱과 HTTP/2를 통해 성능을 최적화합니다.

### 개요

| 항목 | 설명 |
|-----|------|
| 프록시 대상 | Google Maps Tiles API |
| 캐싱 | LRU 캐시 (기본 1000개 타일, 1시간 TTL) |
| 프로토콜 | HTTP/2 지원 |
| 세션 관리 | 자동 갱신 (만료 전 60초에 갱신) |

---

### 헬스 체크
```
GET /health
```
서버 상태를 확인합니다.

#### Response (200 OK)
```
ok
```

---

### 타일 프록시
```
GET /maps/tiles/{z}/{x}/{y}.png
```
Google Maps 타일을 프록시하여 반환합니다.

#### Path Parameters
| 파라미터 | 타입 | 범위 | 설명 |
|---------|------|------|------|
| z | int | 0-22 | 줌 레벨 |
| x | int | 0 ~ 2^z-1 | X 타일 좌표 |
| y | int | 0 ~ 2^z-1 | Y 타일 좌표 |

#### Query Parameters
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| lang | string | ko-KR | 타일 언어 (BCP-47 형식) |
| region | string | KR | 타일 지역 (ISO 3166-1 alpha-2) |
| mapType | string | roadmap | 지도 유형 |

#### mapType 옵션
| 값 | 설명 |
|----|------|
| roadmap | 일반 도로 지도 |
| satellite | 위성 이미지 |
| terrain | 지형 지도 |

#### Response Headers
| 헤더 | 설명 |
|-----|------|
| Cache-Control | 캐시 정책 (기본: public, max-age=3600) |
| X-Tile-Proxy | 프록시 식별자 (google-map-tiles) |
| X-Tile-Language | 적용된 언어 |
| X-Tile-Region | 적용된 지역 |
| X-Cache | 캐시 상태 (HIT/MISS) |

#### Response (200 OK)
- Content-Type: `image/png`
- 256x256 픽셀 지도 타일 이미지

#### 사용 예시

**기본 요청**
```
GET /maps/tiles/15/27959/12824.png
```

**한국어 + 위성 지도**
```
GET /maps/tiles/15/27959/12824.png?lang=ko-KR&region=KR&mapType=satellite
```

**영어 + 지형 지도**
```
GET /maps/tiles/12/3456/1234.png?lang=en-US&region=US&mapType=terrain
```

#### 줌 레벨 참고

| 줌 레벨 | 대략적 범위 |
|--------|------------|
| 0 | 전 세계 |
| 5 | 대륙 |
| 10 | 도시 |
| 15 | 거리 |
| 18 | 건물 |
| 22 | 최대 확대 |

#### Error Response

| 상태 코드 | 원인 |
|----------|------|
| 400 | 잘못된 z/x/y 좌표 |
| 500 | 서버 설정 오류 (API 키 없음) |
| 502 | Google API 오류 |

---

### 환경 변수 설정

| 변수 | 기본값 | 설명 |
|-----|--------|------|
| GOOGLE_MAPS_API_KEY | (필수) | Google Maps API 키 |
| GOOGLE_MAP_TYPE | roadmap | 기본 지도 유형 |
| GOOGLE_TILE_LANGUAGE | ko-KR | 기본 타일 언어 |
| GOOGLE_TILE_REGION | KR | 기본 타일 지역 |
| TILE_TIMEOUT_SECONDS | 12 | 타일 요청 타임아웃 (초) |
| TILE_CACHE_SIZE | 1000 | 타일 캐시 최대 개수 |
| TILE_CACHE_TTL_SECONDS | 3600 | 타일 캐시 TTL (초) |
| MAX_ZOOM | 22 | 최대 줌 레벨 |
| SESSION_FALLBACK_TTL_SECONDS | 600 | 세션 기본 TTL (초) |
| SESSION_REFRESH_GRACE_SECONDS | 60 | 세션 갱신 여유 시간 (초) |
| MAX_SESSION_CACHE_SIZE | 128 | 세션 캐시 최대 개수 |

---

### 타일 좌표 계산

위도/경도를 타일 좌표로 변환하는 공식:

```javascript
function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y, z: zoom };
}

// 예: 서울시청 (37.5665, 126.9780) at zoom 15
// → { x: 27959, y: 12824, z: 15 }
```

---

### 클라이언트 연동 예시

**React Native (MapLibre)**
```javascript
<MapView
    styleURL={{
        version: 8,
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: ['https://your-server.com/maps/tiles/{z}/{x}/{y}.png?lang=ko-KR'],
                tileSize: 256,
            },
        },
        layers: [{
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
        }],
    }}
/>
```

**Leaflet.js**
```javascript
L.tileLayer('https://your-server.com/maps/tiles/{z}/{x}/{y}.png?lang=ko-KR&mapType=roadmap', {
    maxZoom: 22,
    attribution: '© Google Maps'
}).addTo(map);
```

---

## 장소 검색 (Places)

Google Places API를 활용한 장소 검색 기능입니다.

---

### 텍스트 검색
```
POST /places/search/text
```
텍스트로 장소를 검색합니다.

#### Request Body
```json
{
    "query": "서울역",
    "location": "37.5665,126.9780",
    "radius": 5000,
    "language": "ko"
}
```

| 필드 | 타입 | 필수 | 설명 |
|-----|------|------|------|
| query | string | O | 검색어 |
| location | string | X | 위도,경도 |
| radius | int | X | 검색 반경 (미터) |
| language | string | X | 언어 (기본: ko) |

#### Response (200 OK)
```json
{
    "message": "Search completed",
    "count": 5,
    "results": [
        {
            "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
            "name": "서울역",
            "address": "서울특별시 중구 한강대로 405",
            "latitude": 37.5546,
            "longitude": 126.9706,
            "types": ["train_station", "transit_station"],
            "rating": 4.2,
            "user_ratings_total": 12345,
            "open_now": true
        }
    ],
    "next_page_token": "..."
}
```

---

### 주변 검색
```
POST /places/search/nearby
```
현재 위치 기반으로 주변 장소를 검색합니다.

#### Request Body
```json
{
    "latitude": 37.5665,
    "longitude": 126.9780,
    "radius": 1000,
    "keyword": "카페",
    "type": "cafe",
    "language": "ko"
}
```

| 필드 | 타입 | 필수 | 설명 |
|-----|------|------|------|
| latitude | float | O | 위도 |
| longitude | float | O | 경도 |
| radius | int | X | 검색 반경 (기본: 1000m) |
| keyword | string | X | 키워드 |
| type | string | X | 장소 유형 |
| language | string | X | 언어 (기본: ko) |

#### Response (200 OK)
```json
{
    "message": "Search completed",
    "count": 10,
    "results": [
        {
            "place_id": "ChIJ...",
            "name": "스타벅스 강남점",
            "address": "강남대로 123",
            "latitude": 37.5012,
            "longitude": 127.0396,
            "types": ["cafe"],
            "rating": 4.0,
            "user_ratings_total": 500,
            "open_now": true
        }
    ],
    "next_page_token": "..."
}
```

---

### 자동완성
```
GET /places/autocomplete
```
검색어 입력 시 실시간 장소 추천을 제공합니다.

#### Query Parameters
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| input | string | O | 검색어 |
| location | string | X | 위도,경도 |
| radius | int | X | 검색 반경 (미터) |
| language | string | X | 언어 (기본: ko) |

#### 사용 예시
```
GET /places/autocomplete?input=서울역&location=37.5665,126.9780
```

#### Response (200 OK)
```json
{
    "message": "Autocomplete completed",
    "count": 5,
    "predictions": [
        {
            "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
            "description": "서울역, 서울특별시 중구",
            "main_text": "서울역",
            "secondary_text": "서울특별시 중구",
            "types": ["train_station"]
        }
    ]
}
```

---

### 장소 상세 정보
```
GET /places/details/{place_id}
```
place_id로 장소의 상세 정보를 조회합니다.

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| place_id | string | 장소 ID |

#### Query Parameters
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| language | string | ko | 언어 |

#### Response (200 OK)
```json
{
    "message": "Details retrieved",
    "place": {
        "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "name": "서울역",
        "address": "서울특별시 중구 한강대로 405",
        "phone": "02-1234-5678",
        "latitude": 37.5546,
        "longitude": 126.9706,
        "types": ["train_station", "transit_station"],
        "rating": 4.2,
        "user_ratings_total": 12345,
        "opening_hours": [
            "월요일: 24시간 영업",
            "화요일: 24시간 영업"
        ],
        "open_now": true,
        "website": "https://www.seoulstation.co.kr",
        "google_maps_url": "https://maps.google.com/?cid=..."
    }
}
```

---

### 장소 유형 (type) 참고

| 유형 | 설명 |
|-----|------|
| cafe | 카페 |
| restaurant | 음식점 |
| subway_station | 지하철역 |
| train_station | 기차역 |
| bus_station | 버스 정류장 |
| hospital | 병원 |
| pharmacy | 약국 |
| convenience_store | 편의점 |
| parking | 주차장 |

전체 목록: [Google Place Types](https://developers.google.com/maps/documentation/places/web-service/supported_types)

---

## 공통 에러 응답

| 상태 코드 | 설명 |
|----------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 404 | 리소스를 찾을 수 없음 |
| 415 | 지원하지 않는 미디어 타입 |
| 500 | 서버 내부 오류 |
| 502 | 외부 API 오류 |

```json
{
    "detail": "에러 메시지"
}
```
