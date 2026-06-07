# Pogo Penguin Runner - PWA 배포 메모

이 폴더는 정적 웹호스팅에 그대로 업로드할 수 있는 PWA(Progressive Web App) 버전입니다.

## 포함 파일

- `index.html` : 게임 시작 파일
- `style.css` : 화면/모바일 조작 UI 스타일
- `game.js` : 게임 로직
- `manifest.webmanifest` : 홈화면 설치용 앱 정보
- `service-worker.js` : 오프라인 캐시
- `assets/` : 캐릭터 이미지와 앱 아이콘

## iPhone에서 설치 테스트

1. 이 폴더 전체를 HTTPS 정적 웹호스팅에 업로드합니다.
2. iPhone Safari에서 배포 URL에 접속합니다.
3. 공유 버튼을 누릅니다.
4. `홈 화면에 추가`를 선택합니다.
5. 홈 화면의 앱 아이콘으로 실행합니다.

## 주의

- iOS에서 PWA 설치/서비스워커는 HTTPS 환경에서 정상 동작합니다.
- 로컬 파일(`file://`)로 열면 서비스워커와 설치 기능이 제대로 동작하지 않습니다.
- 효과음/BGM은 브라우저 정책상 첫 터치 또는 버튼 입력 이후 재생됩니다.
