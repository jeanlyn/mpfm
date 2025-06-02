// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod core;
mod protocols;
mod tauri_commands;
mod utils;

use tauri_commands::*;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_connections,
            add_connection,
            remove_connection,
            copy_connection,
            update_connection,
            check_s3_bucket_exists,
            create_s3_bucket,
            list_files,
            list_files_paginated,
            upload_file,
            download_file,
            delete_file,
            create_directory,
            get_directory_count,
            search_files,
            get_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
