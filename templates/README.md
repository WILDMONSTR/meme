# 템플릿 JSON 저장

Meme Studio는 GitHub Pages에서 서버 파일을 직접 변경하지 않고, 브라우저의 사이트 전용 저장공간에 `template-1.json`~`template-3.json`을 저장합니다.

- 최신 Chrome/Edge 등에서 Origin Private File System(OPFS)을 사용할 수 있으면 실제 `.json` 파일 형태로 저장합니다.
- OPFS를 지원하지 않는 브라우저에서는 동일한 JSON 데이터를 localStorage에 저장합니다.
- 각 템플릿 카드의 `JSON 내보내기`로 백업 파일을 만들 수 있습니다.
- `JSON 복원`으로 정상 JSON을 특정 슬롯에 넣어 손상/누락된 템플릿을 복구할 수 있습니다.
- JSON 구조가 올바르지 않거나 문법이 깨진 경우 해당 슬롯은 `손상됨`으로 표시되며 기존 다른 슬롯은 유지됩니다.
