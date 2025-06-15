// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod commands;
mod core;
mod protocols;
mod utils;

// Import commands directly
use commands::config;
use commands::connection;
use commands::file;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            connection::get_connections,
            connection::add_connection,
            connection::remove_connection,
            connection::copy_connection,
            connection::update_connection,
            connection::check_s3_bucket_exists,
            connection::create_s3_bucket,
            file::list_files,
            file::list_files_paginated,
            file::upload_file,
            file::download_file,
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
            config::import_app_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
