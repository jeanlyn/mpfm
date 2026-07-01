// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use multi_protocol_file_manager::commands::{config, connection, diagnostics, file};
use multi_protocol_file_manager::utils::logger;
use multi_protocol_file_manager::VERSION;

fn main() {
    if let Some(log_path) = logger::init(log::LevelFilter::Info) {
        info!("mpfm {VERSION} starting");
        info!("Log file: {}", log_path.display());
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            connection::get_connections,
            connection::reload_connections,
            connection::add_connection,
            connection::remove_connection,
            connection::copy_connection,
            connection::update_connection,
            connection::check_s3_bucket_exists,
            connection::create_s3_bucket,
            connection::list_s3_buckets,
            file::list_files,
            file::list_files_paginated,
            file::upload_file,
            file::upload_directory,
            file::cancel_upload,
            file::download_file,
            file::build_download_command,
            file::build_download_curl_command,
            file::copy_text_to_clipboard,
            file::batch_download_files,
            file::delete_file,
            file::create_directory,
            file::get_directory_count,
            file::search_files,
            file::get_file_content,
            config::save_app_config,
            config::load_app_config,
            config::delete_app_config,
            config::export_app_config,
            config::import_app_config,
            diagnostics::get_diagnostics_report,
            diagnostics::export_diagnostics_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
