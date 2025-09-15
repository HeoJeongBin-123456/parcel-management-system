#!/bin/bash

# 테스트가 완료될 때까지 대기
while true; do
    if ! pgrep -f "playwright test" > /dev/null; then
        # 테스트 완료 - 알림 울리기
        echo "🎉 테스트 완료!"

        # macOS 알림 소리 재생
        afplay /System/Library/Sounds/Glass.aiff

        # 시각적 알림도 표시
        osascript -e 'display notification "Playwright 테스트가 완료되었습니다!" with title "테스트 완료" sound name "Glass"'

        break
    fi
    sleep 2
done