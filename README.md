# STONK Arcade v3.1.1 - Lottery UX & Market UI Patch

## 변경점

- Firebase 설정 적용판 유지
- 복권을 자동 결과형에서 번호 선택형으로 변경
  - 1~30 중 6개 직접 선택
  - 자동 선택 / 초기화 지원
  - 추첨 번호가 하나씩 공개됨
  - 맞은 번호 하이라이트
- Battle/Board와 비슷한 어두운 시장 터미널형 UI로 조정
  - LIVE 상태칩
  - 패널형 정보 카드
  - 로그 카드 강조선
  - 게임 헤더/카테고리 시각 정리
- Firebase 사용량 최소화 유지
  - 입장 시 1회 로드
  - 게임 결과 확정 시 cash/stats/log 1회 정산
  - 복권 번호 선택/추첨 연출 중에는 Firebase 쓰기 없음

## 빌드

```powershell
npm install
npm run build
```

## 배포

```powershell
npm run build
Set-Location ".\\dist"
git init
git add .
git commit -m "Deploy STONK Arcade v3.1.1"
git branch -M gh-pages
git remote set-url origin https://github.com/tom981105-web/STONK-Arcade.git
git push -f origin gh-pages
Set-Location ".."
```


## v3.1.1 정산 실패 표시 패치

- 패배/꽝 결과에서 `보유금이 부족하거나 정산에 실패했습니다.`만 뜨던 문제를 수정했습니다.
- Firebase의 `cash` 필드가 비어 있거나 Battle 쪽 데이터가 `money`, `balance`, `capital` 같은 이름으로 들어온 경우에도 Arcade 정산용 `cash`를 보정합니다.
- 손실 결과도 정상적으로 `손익 -₩...` 형태로 표시됩니다.
- Firebase 쓰기 방식은 결과 확정 시 1회 정산 + 로그 1회 저장 구조를 유지합니다.
