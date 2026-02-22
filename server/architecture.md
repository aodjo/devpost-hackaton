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
    "description": "제보 내용"
}
```

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

| 뱃지명 | 조건 |
|-------|------|
| First Reporter | 장애물 1개 이상 신고 |
| Explorer | 장애물 10개 이상 신고 |
| Photo Contributor | 사진 5개 이상 업로드 |
| Guardian | 검증 10회 이상 |

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
