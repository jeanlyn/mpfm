use serde::Serialize;
use tauri::command;

use crate::utils::diagnostics::build_diagnostics_report;

use super::types::ApiResponse;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReportResponse {
    pub report: String,
    pub log_path: Option<String>,
}

#[command]
pub async fn get_diagnostics_report() -> ApiResponse<DiagnosticsReportResponse> {
    let info = build_diagnostics_report("desktop");
    ApiResponse::success(DiagnosticsReportResponse {
        report: info.report,
        log_path: info.log_path.map(|p| p.to_string_lossy().to_string()),
    })
}

#[command]
pub async fn export_diagnostics_report(path: String) -> ApiResponse<String> {
    let info = build_diagnostics_report("desktop");
    match std::fs::write(&path, &info.report) {
        Ok(_) => ApiResponse::success(path),
        Err(e) => ApiResponse::error(format!("写入诊断文件失败: {e}")),
    }
}
