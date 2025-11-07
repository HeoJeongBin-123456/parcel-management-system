# 메모 삭제 후 새로고침 시 복원되는 버그 수정

**버그 리포트 일시**: 2025-01-08  
**수정 일시**: 2025-01-08  
**심각도**: 중 (Medium)

---

## 🐛 버그 설명

### 증상
프로덕션에서 메모를 삭제해도 새로고침하면 메모가 다시 나타남

### 발생 조건
1. 필지에 메모 입력
2. 저장
3. "삭제" 버튼 클릭 (메모 삭제)
4. 페이지 새로고침
5. **메모가 다시 나타남** ❌

---

## 🔍 원인 분석

### 문제점 1: Supabase에서 메모가 삭제되지 않음
**위치**: `SupabaseManager.deleteParcel()`

**기존 코드**:
```javascript
// DELETE만 실행 (메모 필드는 업데이트하지 않음)
const { data, error } = await this.supabase
    .from('parcels')
    .delete()
    .in(column, candidateList)
```

**문제**: 
- 색상이 있는 필지는 DELETE되지 않고 localStorage에만 `isDeleted=true`로 설정
- Supabase에는 메모가 그대로 남아있음
- 새로고침 시 Supabase에서 메모가 있는 필지를 다시 로드

### 문제점 2: loadMemoparcels()에서 isDeleted 체크 안 함
**위치**: `SupabaseManager.loadMemoparcels()`

**기존 코드**:
```javascript
const { data, error } = await this.supabase
    .from('parcels')
    .select('*')
    .not('memo', 'is', null)
    .neq('memo', '')  // 메모가 있으면 무조건 로드
```

**문제**:
- `isDeleted=true`인 필지도 메모가 있으면 로드됨
- 삭제된 필지인지 확인하지 않음

### 문제점 3: localStorage에서도 isDeleted 체크 부족
**위치**: `MemoMarkerManager.loadAllMemoMarkers()`

**기존 코드**:
```javascript
const withMemo = parsed.filter(parcel => {
    // isDeleted 체크 없음
    return this.shouldShowMarker(parcel);
});
```

**문제**:
- `isDeleted=true`인 필지도 shouldShowMarker()가 true면 로드됨

---

## ✅ 수정 사항

### 1. Supabase 삭제 시 메모 필드 명시적으로 제거

**수정 위치**: `public/js/supabase-config.js` - `deleteParcel()` 메서드

**수정 내용**:
```javascript
// 먼저 메모 필드를 빈 값으로 업데이트 (소프트 삭제)
for (const column of targetColumns) {
    const { data: updateData, error: updateError } = await this.supabase
        .from('parcels')
        .update({
            memo: '',                    // ✅ 메모 제거
            owner_name: '',              // ✅ 소유자 정보 제거
            owner_address: '',           // ✅ 주소 제거
            owner_contact: '',           // ✅ 연락처 제거
            isDeleted: true,             // ✅ 삭제 플래그 설정
            updated_at: new Date().toISOString()
        })
        .in(column, candidateList)
        .select('id, pnu, parcel_name');
}
```

### 2. loadMemoparcels()에서 isDeleted 필터링

**수정 위치**: `public/js/supabase-config.js` - `loadMemoparcels()` 메서드

**수정 내용**:
```javascript
// Supabase에서 로드 후 isDeleted 체크
const filteredData = (data || []).filter(p => p.isDeleted !== true);
console.log('📡 메모 필지 로드 완료:', filteredData.length, '개 (삭제된 필지 제외)');

// localStorage에서 로드 시에도 isDeleted 체크
return parcels.filter(p => {
    // isDeleted 플래그 체크
    if (p.isDeleted === true) {
        return false;
    }
    // deletedParcels 목록 체크
    if (p.pnu && deletedParcels.includes(p.pnu)) {
        return false;
    }
    // 메모가 있는 필지만
    return p.memo && p.memo.trim() !== '';
});
```

### 3. localStorage 메모 필지 로드 시 isDeleted 체크 강화

**수정 위치**: `public/js/memo-markers.js` - `loadAllMemoMarkers()` 메서드

**수정 내용**:
```javascript
const withMemo = parsed.filter(parcel => {
    // isDeleted 플래그 체크 (최우선)
    if (parcel.isDeleted === true) {
        return false;
    }
    
    // 삭제된 필지 목록 체크
    const pnu = parcel.pnu || parcel.properties?.PNU || parcel.properties?.pnu || parcel.id;
    if (pnu && deletedParcels.includes(pnu)) {
        return false;
    }
    
    return this.shouldShowMarker(parcel);
});
```

---

## 🧪 수정 검증

### 테스트 시나리오
1. 메모가 있는 필지 선택
2. "삭제" 버튼 클릭
3. localStorage 확인: `isDeleted: true`, `memo: ''` 확인
4. Supabase 확인: `memo: ''`, `isDeleted: true` 확인
5. 페이지 새로고침
6. 메모 마커가 나타나지 않아야 함 ✅

### 예상 결과
- ✅ 삭제 후 localStorage에 `isDeleted: true` 설정
- ✅ 삭제 후 Supabase에 `memo: ''`, `isDeleted: true` 업데이트
- ✅ 새로고침 시 `loadMemoparcels()`에서 isDeleted=true 필지 제외
- ✅ 메모 마커 생성 안 됨

---

## 📝 수정된 파일

1. `public/js/supabase-config.js`
   - `loadMemoparcels()`: isDeleted 필터링 추가
   - `deleteParcel()`: 메모 필드 명시적 업데이트

2. `public/js/memo-markers.js`
   - `loadAllMemoMarkers()`: isDeleted 체크 강화 (2곳)

---

## 🎯 수정 효과

### Before (수정 전)
```
메모 삭제 → localStorage만 업데이트 → Supabase에 메모 남음
→ 새로고침 → Supabase에서 메모 로드 → 메모 마커 다시 나타남 ❌
```

### After (수정 후)
```
메모 삭제 → localStorage + Supabase 업데이트 (memo='', isDeleted=true)
→ 새로고침 → isDeleted=true 필지 제외 → 메모 마커 안 나타남 ✅
```

---

## 🔒 데이터 무결성

### 소프트 삭제 방식
- 색상이 있는 필지는 완전 삭제하지 않음
- 메모만 제거하고 `isDeleted=true` 플래그 설정
- 색상과 폴리곤은 유지

### 하드 삭제 방식
- `removeColor: true` 옵션 사용 시
- 필지 완전 삭제
- Supabase에서 DELETE 실행

---

## 🚀 배포

수정 사항이 프로덕션에 반영되면 메모 삭제 버그가 해결됩니다.

**배포 후 확인 사항**:
1. 메모 삭제 후 새로고침
2. 메모 마커가 나타나지 않아야 함
3. 색상과 폴리곤은 유지되어야 함

---

**버그 수정 완료** ✅

