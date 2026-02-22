# 장애물 제보 및 조회

## Base URL
- http://localhost:8000

## 장애물 신고
- 이미지 파일과 위도 경보 정보는 따로 전달 해야 한다.
- 이미지 파일은 반드시 '.png' 파일로만 업로드 한다.
- 위도 경도 정보 형식은  형태로 넘겨야 한다.
- 이미지 파일은 업로드 할때 위도 경도 정보를 전달할때 받은 아이디를 경로 파라미터를 통해 넣어 고유 ID도 함께 전달해야한다.

### Request
    Link: /warning/add_place
    Method: POST
    Content-Type: 'application/'
    Body: {
          "name" : "제보 이름",
          "latitude" : "경도",
          "longitude" : "위도",
          "description" : "제보 내용"
    }

### Response
1) Success (200 OK)
성공 시  오브젝트를 반환합니다

#### 예시 
    {
        "message": "Warning place added successfully",
        "id" : "장애물 고유 ID" 
    }


### image Requset
    Link: /warning/update_place_img/<place_id>
    Method: POST
    Content-Type: 'image/png'
    Body: 이미지 파일

### image Response
1) Success (200 OK)
성공 시  오브젝트를 반환합니다

###### 예시 
    {
        "message": "Warning place image updated successfully"
    } 


2) 415 Unsupported Media Type

###### 예시 1 
    {
        "detail": "PNG만 업로드 가능합니다(확장자)."
    } 

- 이는 파일 확장자를 PNG로 바꿔 다시 POST

###### 예시 2
    {
        "detail": "PNG만 업로드 가능합니다(content-type)."
    } 

- 이는 Content-type을 'image/png'로 바꿔 다시 POST

3) 400 Bad Request

###### 예시
    {
        "detail": "Invalid image format"
    } 

- 이는 파일 형식이 맞지 않은것이기에 PNG 파일인지와 이미지 형식인지를 확인후 다시 POST 해주세요 

4) 500 Internal Server Error

###### 예시
    {
        "detail" : "Failed to update warning place image"   
    }

- 이는 서버 장애로 개발자에게 문의 해주세요

## 장애물 조회
 -  장애물을 조회 할때는 출발지, 도착지의 위도,경도 혹은 장애물 고유 ID를 이용하여 조회 할 수 있다.
 - 이미지를 요청할땐 고유 ID를 경로 파라미터로 넣어 조회 해야한다
 - 출발지, 도착지의 위도, 경도로 조회 할때도 위 네가지 항목을  형식으로 넣어 조회 해야한다

### 위도 경도를 이용한 조회
- 이를 이용해 조회 할때는 출발지의 위도, 경도와 도착지의 위도, 경도가 필요하다.
- 이는 출발지와 도착지의 0.001위도, 0.001경도 사이의 장애물들이 조회 된다 

#### Request
    Link: /warning/get_place/
    Method: POST
    Content-Type: 'application/'
    Body: {
       "origin_latitude" : "출발지 경도",
       "origin_longitude" : "출발지 위도",
       "destination_latitude" : "도착지 경도",
       "destination_longitude" : "도착지 위도"
    }

#### Response
1) Success (200 OK)
성공 시  오브젝트를 반환합니다

###### 예시
    {
        "message" : "Warning places retrieved successfully",
        "list" : [
            {
                "id" : "장애물 고유 ID",
                "name" : "장애물 이름",
                "latitude" : "장애물 경도",
                "longitude" : "장애물 위도",
                "description" : "장애물 설명"
            },
        ] 
    }

2) 500 Internal Server Error

###### 예시
    {
        "detail" : "Failed to get warning places"
    }
- 이는 서버 장애로 개발자에게 문의 해주세요

### 장애물 고유 ID를 이용한 조회
- 이를 이용해 조회 할때는 장애물 고유 ID가 필요하다.
- 이는 장애물 고유 ID를 경로 파라미터로 넣어 조회 해야한다
- 이는 특정 장애물 하나만 조회가 된다.

#### Request
    Link: /warning/get_place/<place_id>
    Method: GET

#### Response
1) Success (200 OK)
성공 시  오브젝트를 반환합니다

###### 예시
    {
        "message" : "Warning place retrieved successfully",
        "place" : {
            "id" : "장애물 고유 ID",
            "name" : "장애물 이름",
            "latitude" : "장애물 경도",
            "longitude" : "장애물 위도",
            "description" : "장애물 설명"
        }
    }


2) 500 Internal Server Error

###### 예시
    {
       "detail" : "Failed to get warning place"
    }

- 이는 서버 장애로 개발자에게 문의 해주세요