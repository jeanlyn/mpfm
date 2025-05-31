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
            list_files,
            list_files_paginated,
            get_directory_count,
            upload_file,
            download_file,
            delete_file,
            create_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
