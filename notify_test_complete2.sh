#!/bin/bash

# 테스트가 완료될 때까지 대기
while pgrep -f "playwright test" > /dev/null; do
    sleep 2
done

# 테스트 완료 - 알림 울리기
echo "🎉 테스트 재실행 완료!"

# macOS 알림 소리 재생
afplay /System/Library/Sounds/Glass.aiff

# 시각적 알림도 표시
osascript -e 'display notification "모든 수정 후 테스트가 완료되었습니다!" with title "테스트 완료" sound name "Glass"'