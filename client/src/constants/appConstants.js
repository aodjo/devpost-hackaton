export const LABELS = {
  home: '홈',
  navigation: '내비게이션',
  transit: '대중교통',
  profile: '내 정보',
  road: '간략',
  satellite: '위성',
  bus: '버스',
  subway: '지하철',
  placeSearchPlaceholder: '건물, 장소 검색',
  originPlaceholder: '출발지 입력',
  destinationPlaceholder: '목적지 입력',
  search: '검색',
  permissionRequired: '위치 권한 필요',
  locationLoadFailed: '위치 불러오기 실패',
  focusMyLocation: '내 위치로 포커스',
  navigationPanelTitle: '추천 경로',
  eta: '예상 도착',
  duration: '소요',
  distance: '거리',
  startGuidance: '안내 시작',
  currentLocation: '현재 위치',
  setDestination: '목적지 설정',
  routeHint: '출발지와 목적지를 입력하면 경로가 표시됩니다.',
}

export const NAV_ITEMS = [LABELS.home, LABELS.navigation, LABELS.transit, LABELS.profile]

export const INITIAL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

export const SEARCH_BUTTON_HEIGHT = 34
export const NAVBAR_RADIUS = 14
export const NAVBAR_VERTICAL_PADDING = 8
export const NAVBAR_HORIZONTAL_PADDING = 6

export const NAVIGATION_STEPS = [
  { id: 'step-1', icon: 'trip-origin', text: '출발 후 300m 직진' },
  { id: 'step-2', icon: 'turn-right', text: '삼일대로에서 우회전' },
  { id: 'step-3', icon: 'straight', text: '하단 루트로 1.8km 이동' },
  { id: 'step-4', icon: 'flag', text: '목적지 도착' },
]
