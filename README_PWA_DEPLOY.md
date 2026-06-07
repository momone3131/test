# 외발 펭귄 PWA 배포 메모

GitHub Pages에 올릴 때 저장소 루트에 아래 파일/폴더가 있어야 합니다.

```text
index.html
style.css
game.js
manifest.webmanifest
service-worker.js
README_PWA_DEPLOY.md
assets/
```

배포 URL 예시:

```text
https://momone3131.github.io/test/
```

아이폰에서 실행:

1. Safari로 GitHub Pages URL 접속
2. 공유 버튼 선택
3. 홈 화면에 추가
4. 홈 화면 아이콘으로 실행

주의:

- `github.com/...` 주소가 아니라 `github.io/...` 주소로 접속해야 게임이 실행됩니다.
- 이전 버전이 캐시에 남아 있으면 Safari 새로고침 또는 홈 화면 아이콘 삭제 후 재추가가 필요할 수 있습니다.
- iOS 사운드는 첫 터치 이후 재생됩니다.
