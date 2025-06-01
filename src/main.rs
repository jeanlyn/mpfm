// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod core;
mod protocols;
mod utils;
mod tauri_commands;

use tauri_commands::*;

fn main() {
    env_logger::init();
    
    tauri::Builder::default()
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
