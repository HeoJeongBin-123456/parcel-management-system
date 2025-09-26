/**
 * Supabase Edge Function: 매일 자동 백업
 * - 매일 새벽 2시 (KST) 자동 실행
 * - 사용자 접속 불필요
 * - Supabase Storage에 백업 파일 저장
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 초기화 (서비스 역할 키 사용)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🚀 일일 백업 시작...");

    // 1. 모든 필지 데이터 가져오기
    const { data: parcels, error: fetchError } = await supabase
      .from("parcels")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw new Error(`데이터 조회 실패: ${fetchError.message}`);
    }

    console.log(`📊 백업 대상: ${parcels?.length || 0}개 필지`);

    if (!parcels || parcels.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: "백업할 데이터가 없습니다",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 2. 백업 데이터 생성
    const backupData = {
      timestamp: new Date().toISOString(),
      count: parcels.length,
      version: "2.0",
      data: parcels,
    };

    const backupJson = JSON.stringify(backupData, null, 2);
    const backupSize = new Blob([backupJson]).size;

    // 3. 파일명 생성 (YYYY-MM-DD 형식)
    const now = new Date();
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC → KST
    const dateStr = kstDate.toISOString().split("T")[0];
    const fileName = `backup_${dateStr}.json`;

    console.log(`💾 백업 파일 생성: ${fileName} (${(backupSize / 1024).toFixed(2)}KB)`);

    // 4. Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("backups")
      .upload(fileName, backupJson, {
        contentType: "application/json",
        upsert: true, // 같은 날짜 파일이 있으면 덮어쓰기
      });

    if (uploadError) {
      // 버킷이 없으면 생성 시도
      if (uploadError.message.includes("not found") || uploadError.message.includes("Bucket")) {
        console.log("📦 백업 버킷 생성 중...");

        const { error: bucketError } = await supabase.storage.createBucket("backups", {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024, // 50MB
        });

        if (bucketError && !bucketError.message.includes("already exists")) {
          throw new Error(`버킷 생성 실패: ${bucketError.message}`);
        }

        // 버킷 생성 후 재시도
        const { error: retryError } = await supabase.storage
          .from("backups")
          .upload(fileName, backupJson, {
            contentType: "application/json",
            upsert: true,
          });

        if (retryError) {
          throw new Error(`백업 업로드 실패 (재시도): ${retryError.message}`);
        }
      } else {
        throw new Error(`백업 업로드 실패: ${uploadError.message}`);
      }
    }

    console.log(`✅ Supabase Storage 업로드 완료: ${fileName}`);

    // 5. daily_backups 테이블에도 메타데이터 저장 (기존 시스템과 호환성)
    try {
      const { error: dbError } = await supabase.from("daily_backups").insert({
        backup_date: backupData.timestamp,
        data_count: backupData.count,
        backup_data: backupData.data,
        backup_size: backupSize,
        backup_version: backupData.version,
      });

      if (dbError) {
        console.warn(`⚠️ daily_backups 테이블 저장 실패 (무시): ${dbError.message}`);
      } else {
        console.log("✅ daily_backups 테이블에도 저장 완료");
      }
    } catch (dbError) {
      console.warn("⚠️ daily_backups 테이블 접근 불가 (무시)");
    }

    // 6. 30일 이상 된 백업 파일 정리
    await cleanupOldBackups(supabase);

    // 7. 백업 완료 응답
    const response = {
      success: true,
      fileName: fileName,
      count: parcels.length,
      size: backupSize,
      sizeKB: (backupSize / 1024).toFixed(2),
      timestamp: backupData.timestamp,
      message: `백업 완료: ${parcels.length}개 필지`,
    };

    console.log("🎉 일일 백업 완료:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ 백업 실패:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * 30일 이상 된 백업 파일 정리
 */
async function cleanupOldBackups(supabase: any) {
  try {
    console.log("🧹 오래된 백업 파일 정리 시작...");

    // Storage 백업 파일 목록 조회
    const { data: files, error: listError } = await supabase.storage
      .from("backups")
      .list("", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      console.warn("파일 목록 조회 실패:", listError.message);
      return;
    }

    if (!files || files.length === 0) {
      console.log("정리할 파일 없음");
      return;
    }

    // 30일 기준 날짜
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 삭제할 파일 필터링
    const filesToDelete = files
      .filter((file) => {
        const fileDate = new Date(file.created_at);
        return fileDate < thirtyDaysAgo;
      })
      .map((file) => file.name);

    if (filesToDelete.length === 0) {
      console.log("정리할 오래된 파일 없음");
      return;
    }

    console.log(`🗑️ ${filesToDelete.length}개 파일 삭제 중...`);

    // 파일 삭제
    const { error: deleteError } = await supabase.storage
      .from("backups")
      .remove(filesToDelete);

    if (deleteError) {
      console.warn("파일 삭제 실패:", deleteError.message);
    } else {
      console.log(`✅ ${filesToDelete.length}개 파일 삭제 완료`);
    }

    // daily_backups 테이블도 정리
    try {
      const { error: dbDeleteError } = await supabase
        .from("daily_backups")
        .delete()
        .lt("backup_date", thirtyDaysAgo.toISOString());

      if (dbDeleteError) {
        console.warn("daily_backups 테이블 정리 실패:", dbDeleteError.message);
      } else {
        console.log("✅ daily_backups 테이블 정리 완료");
      }
    } catch (e) {
      console.warn("daily_backups 테이블 정리 건너뜀");
    }
  } catch (error) {
    console.warn("백업 정리 중 오류:", error);
  }
}