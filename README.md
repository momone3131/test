# 외발 펭귄 PWA 배포

이 폴더의 파일들을 GitHub Pages 같은 정적 호스팅 저장소 루트에 업로드하면 됩니다.

필수 구조:

```text
index.html
style.css
game.js
manifest.webmanifest
service-worker.js
assets/
```

업로드 후 `https://<GitHub아이디>.github.io/<저장소이름>/?v=41` 로 확인하세요.

## v41 변경점

- 모바일 터치 조작은 터치 기기에서 자동 활성화됩니다.
- 시작/게임오버 화면에 Hard Mode 체크박스를 추가했습니다.
- 일반 모드 최고점수와 Hard Mode 최고점수를 분리 저장합니다.
- Hard Mode에서는 왼쪽 위에 `HARD MODE`가 반투명하게 표시됩니다.

- 체크하지 않은 기본 상태가 일반 모드이며, 기존 v39의 쉬운 물리 파라미터를 사용합니다.
- Hard Mode를 체크하면 기존 일반 난이도 물리 파라미터를 사용하고, 최고점수를 별도로 저장합니다.
