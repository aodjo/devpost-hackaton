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
    "type": "stairs"
}
```

| 필드 | 타입 | 필수 | 설명 |
|-----|------|------|------|
| sw_latitude | float | O | 남서쪽 위도 |
| sw_longitude | float | O | 남서쪽 경도 |
| ne_latitude | float | O | 북동쪽 위도 |
| ne_longitude | float | O | 북동쪽 경도 |
| type | string | X | 필터: `obstacle`, `stairs`, `elevator` (없으면 전체) |

#### Response (200 OK)
```json
{
    "message": "Places retrieved successfully",
    "stats": {
        "total": 15,
        "obstacle": 8,
        "stairs": 4,
        "elevator": 3
    },
    "places": [
        {
            "id": 1,
            "user_id": 1,
            "name": "지하철역 계단",
            "latitude": 37.5650,
            "longitude": 126.9800,
            "description": "가파른 계단",
            "type": "stairs",
            "has_image": 1,
            "verification_count": 3,
            "created_at": "2024-01-01 12:00:00",
            "updated_at": "2024-01-01 12:30:00"
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
    "type": "obstacle"
}
```

| 필드 | 타입 | 필수 | 설명 |
|-----|------|------|------|
| user_id | int | O | 사용자 ID |
| name | string | O | 제보 이름 |
| latitude | float | O | 위도 |
| longitude | float | O | 경도 |
| description | string | O | 제보 내용 |
| type | string | X | 타입: `obstacle`(기본), `stairs`, `elevator` |

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
            "type": "obstacle",
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
        "type": "obstacle",
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

### 헬스 체크
```
GET /health
```

#### Response (200 OK)
```
ok
```

---

### 타일 프록시
```
GET /maps/tiles/{z}/{x}/{y}.png
```
Google Maps 타일을 프록시합니다.

#### Path Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| z | int | 줌 레벨 (0-22) |
| x | int | X 좌표 |
| y | int | Y 좌표 |

#### Query Parameters
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| lang | string | ko-KR | 타일 언어 |
| region | string | KR | 타일 지역 |
| mapType | string | roadmap | 지도 유형 (roadmap/satellite/terrain) |

#### Response (200 OK)
- Content-Type: `image/png`
- 지도 타일 이미지

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
