use std::collections::HashSet;
use std::env;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use log::{info, warn};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::command;
use tokio::process::Command;
use tokio::time::{interval, MissedTickBehavior};
use uuid::Uuid;

use crate::core::file::FileManager;
use crate::protocols::create_protocol;

use super::types::ApiResponse;
use super::utils::get_connection_config;

const EDIT_POLL_INTERVAL: Duration = Duration::from_millis(500);
const EDIT_SAVE_DEBOUNCE: Duration = Duration::from_millis(750);
const FAILED_UPLOAD_RETRY: Duration = Duration::from_secs(2);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditFileResult {
    pub changed: bool,
    pub uploaded: bool,
    pub sync_count: usize,
    pub editor_name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedEditor {
    pub name: String,
    pub path: String,
}

#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq)]
enum EditorKind {
    VisualStudioCode,
    VisualStudioCodeInsiders,
    Vscodium,
    Notepad3,
    Notepad,
    TextEdit,
}

impl EditorKind {
    fn display_name(self) -> &'static str {
        match self {
            Self::VisualStudioCode => "VS Code",
            Self::VisualStudioCodeInsiders => "VS Code Insiders",
            Self::Vscodium => "VSCodium",
            Self::Notepad3 => "Notepad3",
            Self::Notepad => "Notepad",
            Self::TextEdit => "TextEdit",
        }
    }

    fn executable_names(self) -> &'static [&'static str] {
        match self {
            Self::VisualStudioCode => &["Code.exe"],
            Self::VisualStudioCodeInsiders => &["Code - Insiders.exe", "Code.exe"],
            Self::Vscodium => &["VSCodium.exe", "codium.exe"],
            Self::Notepad3 => &["Notepad3.exe"],
            Self::Notepad => &["notepad.exe"],
            Self::TextEdit => &["TextEdit"],
        }
    }

    fn sort_order(self) -> usize {
        match self {
            Self::VisualStudioCode => 0,
            Self::VisualStudioCodeInsiders => 1,
            Self::Vscodium => 2,
            Self::Notepad3 => 3,
            Self::Notepad => 4,
            Self::TextEdit => 5,
        }
    }
}

fn is_native_default_editor(kind: EditorKind) -> bool {
    #[cfg(target_os = "windows")]
    {
        kind == EditorKind::Notepad
    }
    #[cfg(target_os = "macos")]
    {
        kind == EditorKind::TextEdit
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = kind;
        false
    }
}

fn editor_kind_from_name(value: &str) -> Option<EditorKind> {
    let value = value.to_ascii_lowercase();
    if value.contains("visual studio code insiders") || value.contains("code - insiders") {
        Some(EditorKind::VisualStudioCodeInsiders)
    } else if value.contains("visual studio code") || value == "code" || value == "code.exe" {
        Some(EditorKind::VisualStudioCode)
    } else if value.contains("vscodium") || value == "codium" || value == "codium.exe" {
        Some(EditorKind::Vscodium)
    } else if value.contains("notepad3") {
        Some(EditorKind::Notepad3)
    } else if value == "notepad" || value == "notepad.exe" {
        Some(EditorKind::Notepad)
    } else if value.contains("textedit") {
        Some(EditorKind::TextEdit)
    } else {
        None
    }
}

fn editor_kind_from_path(path: &Path) -> Option<EditorKind> {
    path.file_name()
        .and_then(|value| value.to_str())
        .and_then(editor_kind_from_name)
}

struct TemporaryEditDirectory {
    path: PathBuf,
}

impl TemporaryEditDirectory {
    fn create() -> std::io::Result<Self> {
        let path = env::temp_dir()
            .join("mpfm-edits")
            .join(Uuid::new_v4().to_string());
        fs::create_dir_all(&path)?;
        Ok(Self { path })
    }
}

impl Drop for TemporaryEditDirectory {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_dir_all(&self.path) {
            warn!(
                "清理在线编辑临时目录失败 {}: {}",
                self.path.display(),
                error
            );
        }
    }
}

#[derive(Debug)]
struct EditorCommand {
    executable: PathBuf,
    prefix_args: Vec<String>,
    display_name: String,
}

fn sanitize_file_name(remote_path: &str) -> String {
    let name = Path::new(remote_path)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("remote-file.txt");

    let sanitized: String = name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0' => '_',
            _ => character,
        })
        .collect();

    if sanitized.is_empty() {
        "remote-file.txt".to_string()
    } else {
        sanitized
    }
}

fn file_digest(path: &Path) -> std::io::Result<Vec<u8>> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(hasher.finalize().to_vec())
}

fn editor_prefix_args(executable: &Path) -> Vec<String> {
    let name = executable
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if matches!(
        editor_kind_from_path(executable),
        Some(
            EditorKind::VisualStudioCode
                | EditorKind::VisualStudioCodeInsiders
                | EditorKind::Vscodium
        )
    ) || name == "gedit"
        || name == "xed"
    {
        vec!["--wait".to_string()]
    } else if name == "notepad3" {
        // Notepad3 can be configured to reuse an existing window. /n forces a
        // dedicated process so the process lifetime reliably bounds this edit session.
        vec!["/n".to_string()]
    } else if name == "kate" {
        vec!["--block".to_string()]
    } else {
        Vec::new()
    }
}

fn executable_on_path(name: &str) -> Option<PathBuf> {
    let candidate = Path::new(name);
    if candidate.is_file() {
        return Some(candidate.to_path_buf());
    }

    if candidate.components().count() > 1 {
        return None;
    }

    let path = env::var_os("PATH")?;
    let extensions: Vec<String> = if cfg!(windows) && candidate.extension().is_none() {
        env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.COM;.BAT;.CMD".to_string())
            .split(';')
            .map(str::to_string)
            .collect()
    } else {
        vec![String::new()]
    };

    for directory in env::split_paths(&path) {
        for extension in &extensions {
            let full_path = directory.join(format!("{}{}", name, extension));
            if full_path.is_file() {
                return Some(full_path);
            }
        }
    }
    None
}

fn automatic_editor_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for variable in ["MPFM_EDITOR", "VISUAL", "EDITOR"] {
        if let Some(value) = env::var_os(variable).filter(|value| !value.is_empty()) {
            candidates.push(PathBuf::from(value));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
            let local_app_data = PathBuf::from(local_app_data);
            candidates.push(
                local_app_data
                    .join("Programs")
                    .join("Microsoft VS Code Insiders")
                    .join("Code - Insiders.exe"),
            );
            candidates.push(
                local_app_data
                    .join("Programs")
                    .join("Microsoft VS Code")
                    .join("Code.exe"),
            );
            candidates.push(
                local_app_data
                    .join("Programs")
                    .join("VSCodium")
                    .join("VSCodium.exe"),
            );
            candidates.push(
                local_app_data
                    .join("Programs")
                    .join("Notepad3")
                    .join("Notepad3.exe"),
            );
        }
        for variable in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(program_files) = env::var_os(variable) {
                let program_files = PathBuf::from(program_files);
                candidates.push(program_files.join("Notepad3").join("Notepad3.exe"));
                candidates.push(
                    program_files
                        .join("Rizonesoft")
                        .join("Notepad3")
                        .join("Notepad3.exe"),
                );
                candidates.push(program_files.join("Microsoft VS Code").join("Code.exe"));
                candidates.push(
                    program_files
                        .join("Microsoft VS Code Insiders")
                        .join("Code - Insiders.exe"),
                );
                candidates.push(program_files.join("VSCodium").join("VSCodium.exe"));
            }
        }
        candidates.extend(
            [
                "Code.exe",
                "Code - Insiders.exe",
                "VSCodium.exe",
                "codium.exe",
                "Notepad3.exe",
                "notepad.exe",
            ]
            .map(PathBuf::from),
        );
    }

    #[cfg(target_os = "linux")]
    candidates.extend(["code", "codium", "gedit", "kate", "xed"].map(PathBuf::from));

    #[cfg(target_os = "macos")]
    {
        let mut application_directories = vec![PathBuf::from("/Applications")];
        if let Some(home) = dirs::home_dir() {
            application_directories.push(home.join("Applications"));
        }
        for directory in application_directories {
            candidates.push(directory.join("Visual Studio Code.app"));
            candidates.push(directory.join("Visual Studio Code - Insiders.app"));
            candidates.push(directory.join("VSCodium.app"));
        }
        candidates.push(PathBuf::from("/System/Applications/TextEdit.app"));
        candidates.extend(["code", "code-insiders", "codium"].map(PathBuf::from));
    }

    candidates
}

#[cfg(target_os = "macos")]
fn is_macos_app_bundle(path: &Path) -> bool {
    path.is_dir()
        && path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
}

fn editor_candidate_exists(path: &Path) -> bool {
    if path.is_file() {
        return true;
    }
    #[cfg(target_os = "macos")]
    {
        is_macos_app_bundle(path)
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

fn editor_command_from_path(path: PathBuf) -> Result<EditorCommand, String> {
    #[cfg(target_os = "macos")]
    if is_macos_app_bundle(&path) {
        let kind = editor_kind_from_path(&path);
        let cli_relative_path = match kind {
            Some(EditorKind::VisualStudioCode) => Some("Contents/Resources/app/bin/code"),
            Some(EditorKind::VisualStudioCodeInsiders) => {
                Some("Contents/Resources/app/bin/code-insiders")
            }
            Some(EditorKind::Vscodium) => Some("Contents/Resources/app/bin/codium"),
            _ => None,
        };

        if let Some(relative_path) = cli_relative_path {
            let cli_path = path.join(relative_path);
            if cli_path.is_file() {
                return Ok(EditorCommand {
                    executable: cli_path,
                    prefix_args: vec!["--wait".to_string()],
                    display_name: kind
                        .map(EditorKind::display_name)
                        .unwrap_or("Editor")
                        .to_string(),
                });
            }
        }

        return Ok(EditorCommand {
            executable: PathBuf::from("/usr/bin/open"),
            prefix_args: vec![
                "-W".to_string(),
                "-a".to_string(),
                path.to_string_lossy().to_string(),
            ],
            display_name: kind
                .map(EditorKind::display_name)
                .or_else(|| path.file_stem().and_then(|value| value.to_str()))
                .unwrap_or("Editor")
                .to_string(),
        });
    }

    let display_name = editor_kind_from_path(&path)
        .map(EditorKind::display_name)
        .or_else(|| path.file_stem().and_then(|value| value.to_str()))
        .unwrap_or("editor")
        .to_string();
    Ok(EditorCommand {
        prefix_args: editor_prefix_args(&path),
        executable: path,
        display_name,
    })
}

#[cfg(target_os = "windows")]
fn expand_windows_environment(value: &str) -> String {
    let mut expanded = value.to_string();
    for variable in [
        "LOCALAPPDATA",
        "APPDATA",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "SystemRoot",
        "WINDIR",
    ] {
        if let Some(replacement) = env::var_os(variable) {
            let needle = format!("%{}%", variable);
            while let Some(index) = expanded
                .to_ascii_lowercase()
                .find(&needle.to_ascii_lowercase())
            {
                expanded.replace_range(index..index + needle.len(), &replacement.to_string_lossy());
            }
        }
    }
    expanded
}

#[cfg(target_os = "windows")]
fn registry_value_executable_path(value: &str) -> Option<PathBuf> {
    let value = value.trim();
    let path = if let Some(without_quote) = value.strip_prefix('"') {
        without_quote.split('"').next().unwrap_or_default()
    } else {
        let lowercase = value.to_ascii_lowercase();
        let executable_end = lowercase.find(".exe").map(|index| index + 4)?;
        &value[..executable_end]
    };

    Some(PathBuf::from(expand_windows_environment(path)))
}

#[cfg(target_os = "windows")]
fn registry_editor_candidates() -> Vec<(EditorKind, PathBuf)> {
    use winreg::enums::{
        HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
    };
    use winreg::RegKey;

    let mut candidates = Vec::new();
    let roots = [
        RegKey::predef(HKEY_CURRENT_USER),
        RegKey::predef(HKEY_LOCAL_MACHINE),
    ];
    let views = [KEY_READ | KEY_WOW64_64KEY, KEY_READ | KEY_WOW64_32KEY];

    for root in &roots {
        for flags in views {
            for (executable_name, kind) in [
                ("Code.exe", EditorKind::VisualStudioCode),
                ("Code - Insiders.exe", EditorKind::VisualStudioCodeInsiders),
                ("VSCodium.exe", EditorKind::Vscodium),
                ("Notepad3.exe", EditorKind::Notepad3),
                ("notepad.exe", EditorKind::Notepad),
            ] {
                let key_path = format!(
                    "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{}",
                    executable_name
                );
                if let Ok(key) = root.open_subkey_with_flags(key_path, flags) {
                    if let Ok(path) = key.get_value::<String, _>("") {
                        if let Some(path) = registry_value_executable_path(&path) {
                            candidates.push((kind, path));
                        }
                    }
                }
            }

            let uninstall_path = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
            let Ok(uninstall) = root.open_subkey_with_flags(uninstall_path, flags) else {
                continue;
            };

            for subkey_name in uninstall.enum_keys().flatten() {
                let Ok(application) = uninstall.open_subkey_with_flags(&subkey_name, flags) else {
                    continue;
                };
                let Ok(display_name) = application.get_value::<String, _>("DisplayName") else {
                    continue;
                };
                let Some(kind) = editor_kind_from_name(&display_name) else {
                    continue;
                };

                if let Ok(display_icon) = application.get_value::<String, _>("DisplayIcon") {
                    if let Some(path) = registry_value_executable_path(&display_icon) {
                        candidates.push((kind, path));
                    }
                }

                if let Ok(install_location) = application.get_value::<String, _>("InstallLocation")
                {
                    for executable_name in kind.executable_names() {
                        candidates.push((
                            kind,
                            PathBuf::from(expand_windows_environment(&install_location))
                                .join(executable_name),
                        ));
                    }
                }
            }
        }
    }

    candidates
}

#[cfg(target_os = "windows")]
fn windows_installed_application_paths() -> Vec<PathBuf> {
    use winreg::enums::{
        HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY,
        KEY_WOW64_64KEY,
    };
    use winreg::RegKey;

    let mut paths = Vec::new();
    let roots = [
        RegKey::predef(HKEY_CURRENT_USER),
        RegKey::predef(HKEY_LOCAL_MACHINE),
    ];
    let views = [KEY_READ | KEY_WOW64_64KEY, KEY_READ | KEY_WOW64_32KEY];

    for root in &roots {
        for flags in views {
            let Ok(app_paths) = root.open_subkey_with_flags(
                "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
                flags,
            ) else {
                continue;
            };

            for subkey_name in app_paths.enum_keys().flatten() {
                let Ok(application) = app_paths.open_subkey_with_flags(&subkey_name, flags) else {
                    continue;
                };
                if let Ok(value) = application.get_value::<String, _>("") {
                    if let Some(path) = registry_value_executable_path(&value) {
                        paths.push(path);
                    }
                }
            }
        }
    }

    // HKCR\Applications is the source Windows uses for many "Open with" entries.
    let classes_root = RegKey::predef(HKEY_CLASSES_ROOT);
    if let Ok(applications) = classes_root.open_subkey_with_flags("Applications", KEY_READ) {
        for executable_name in applications.enum_keys().flatten() {
            let command_path = format!("{}\\shell\\open\\command", executable_name);
            let Ok(command) = applications.open_subkey_with_flags(command_path, KEY_READ) else {
                continue;
            };
            if let Ok(value) = command.get_value::<String, _>("") {
                if let Some(path) = registry_value_executable_path(&value) {
                    paths.push(path);
                }
            }
        }
    }

    paths
}

#[cfg(target_os = "macos")]
fn collect_macos_applications(directory: &Path, depth: usize, paths: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if is_macos_app_bundle(&path) {
            paths.push(path);
        } else if depth > 0 && path.is_dir() {
            collect_macos_applications(&path, depth - 1, paths);
        }
    }
}

fn is_likely_text_editor_application(path: &Path) -> bool {
    if editor_kind_from_path(path).is_some() {
        return true;
    }

    let compact_name: String = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();

    matches!(
        compact_name.as_str(),
        "atom"
            | "bbedit"
            | "code"
            | "codeinsiders"
            | "codium"
            | "coteditor"
            | "editplus"
            | "emacs"
            | "emeditor"
            | "emeditor64"
            | "gedit"
            | "geany"
            | "gvim"
            | "helix"
            | "hx"
            | "kate"
            | "lapce"
            | "litexl"
            | "macvim"
            | "micro"
            | "neovim"
            | "nova"
            | "nvim"
            | "pspad"
            | "pulsar"
            | "scite"
            | "sublimetext"
            | "textmate"
            | "textpad"
            | "typora"
            | "uedit32"
            | "uedit64"
            | "ultraedit"
            | "vim"
            | "visualstudiocode"
            | "vscodium"
            | "windsurf"
            | "xed"
            | "zed"
    ) || compact_name.starts_with("cursor")
        || compact_name.starts_with("notepad")
        || compact_name.starts_with("sublimetext")
        || compact_name.starts_with("zedpreview")
}

fn discover_local_applications() -> Vec<DetectedEditor> {
    let mut paths: Vec<PathBuf> = discover_local_editors()
        .into_iter()
        .map(|editor| PathBuf::from(editor.path))
        .collect();

    #[cfg(target_os = "windows")]
    paths.extend(windows_installed_application_paths());

    #[cfg(target_os = "macos")]
    {
        collect_macos_applications(Path::new("/Applications"), 1, &mut paths);
        collect_macos_applications(Path::new("/System/Applications"), 1, &mut paths);
        if let Some(home) = dirs::home_dir() {
            collect_macos_applications(&home.join("Applications"), 1, &mut paths);
        }
    }

    let mut seen = HashSet::new();
    let mut applications: Vec<DetectedEditor> = paths
        .into_iter()
        .filter_map(|path| {
            if !editor_candidate_exists(&path) || !is_likely_text_editor_application(&path) {
                return None;
            }
            let path = fs::canonicalize(&path).unwrap_or(path);
            let key = path.to_string_lossy().to_ascii_lowercase();
            if !seen.insert(key) {
                return None;
            }
            let command = editor_command_from_path(path.clone()).ok()?;
            Some(DetectedEditor {
                name: command.display_name,
                path: path.to_string_lossy().to_string(),
            })
        })
        .collect();

    applications.sort_by(|left, right| {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    });
    applications.truncate(100);
    applications
}

fn discover_local_editors() -> Vec<DetectedEditor> {
    let mut candidates: Vec<(EditorKind, PathBuf)> = automatic_editor_candidates()
        .into_iter()
        .filter_map(|path| {
            let resolved = if editor_candidate_exists(&path) {
                Some(path)
            } else {
                path.to_str().and_then(executable_on_path)
            }?;
            editor_kind_from_path(&resolved).map(|kind| (kind, resolved))
        })
        .collect();

    #[cfg(target_os = "windows")]
    candidates.extend(registry_editor_candidates());

    candidates.retain(|(kind, _)| is_native_default_editor(*kind));

    let mut seen = HashSet::new();
    let mut editors: Vec<(EditorKind, DetectedEditor)> = candidates
        .into_iter()
        .filter_map(|(kind, path)| {
            if !editor_candidate_exists(&path) {
                return None;
            }
            let path = fs::canonicalize(&path).unwrap_or(path);
            let deduplication_key = path.to_string_lossy().to_ascii_lowercase();
            if !seen.insert(deduplication_key) {
                return None;
            }
            Some((
                kind,
                DetectedEditor {
                    name: kind.display_name().to_string(),
                    path: path.to_string_lossy().to_string(),
                },
            ))
        })
        .collect();

    editors.sort_by(|(left_kind, _), (right_kind, _)| {
        left_kind.sort_order().cmp(&right_kind.sort_order())
    });
    let mut seen_kinds = HashSet::new();
    editors
        .into_iter()
        .filter_map(|(kind, editor)| seen_kinds.insert(kind).then_some(editor))
        .collect()
}

fn resolve_editor(configured_path: Option<String>) -> Result<EditorCommand, String> {
    let configured_path = configured_path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let editor_path = if let Some(path) = configured_path {
        let path = PathBuf::from(&path);
        if editor_candidate_exists(&path) {
            path
        } else {
            executable_on_path(path.to_string_lossy().as_ref())
                .ok_or_else(|| format!("配置的文本编辑器不存在或无法执行: {}", path.display()))?
        }
    } else {
        discover_local_editors()
            .into_iter()
            .next()
            .map(|editor| PathBuf::from(editor.path))
            .ok_or_else(|| {
                "未找到可用的本地文本编辑器，请在设置中选择编辑器应用或可执行文件".to_string()
            })?
    };
    editor_command_from_path(editor_path)
}

async fn sync_if_changed(
    file_manager: &FileManager,
    local_path: &Path,
    remote_path: &str,
    digest: &[u8],
) -> Result<(), String> {
    file_manager
        .upload(local_path, remote_path)
        .await
        .map_err(|error| format!("保存后覆盖上传失败: {}", error))?;
    info!(
        "在线编辑内容已同步: {} (sha256 前缀 {:02x?})",
        remote_path,
        &digest[..digest.len().min(4)]
    );
    Ok(())
}

async fn edit_remote_file(
    connection_id: &str,
    remote_path: &str,
    configured_editor_path: Option<String>,
) -> Result<EditFileResult, String> {
    let (protocol_type, config) = get_connection_config(connection_id)?;
    let protocol = create_protocol(&protocol_type, &config)
        .map_err(|error| format!("创建协议失败: {}", error))?;
    let operator = protocol
        .create_operator()
        .map_err(|error| format!("创建操作符失败: {}", error))?;
    let file_manager = FileManager::new(operator);
    let editor = resolve_editor(configured_editor_path)?;

    let temporary_directory = TemporaryEditDirectory::create()
        .map_err(|error| format!("创建在线编辑临时目录失败: {}", error))?;
    let local_path = temporary_directory
        .path
        .join(sanitize_file_name(remote_path));

    file_manager
        .download(remote_path, &local_path)
        .await
        .map_err(|error| format!("下载待编辑文件失败: {}", error))?;

    let original_digest =
        file_digest(&local_path).map_err(|error| format!("读取待编辑文件失败: {}", error))?;
    let mut last_synced_digest = original_digest.clone();
    let mut observed_digest = original_digest;
    let mut observed_at = Instant::now();
    let mut last_upload_attempt: Option<Instant> = None;
    let mut last_upload_error: Option<String> = None;
    let mut sync_count = 0usize;

    let mut child = Command::new(&editor.executable)
        .args(&editor.prefix_args)
        .arg(&local_path)
        .spawn()
        .map_err(|error| {
            format!(
                "启动文本编辑器 {} 失败: {}",
                editor.executable.display(),
                error
            )
        })?;

    let mut process_wait = Box::pin(child.wait());
    let mut poll = interval(EDIT_POLL_INTERVAL);
    poll.set_missed_tick_behavior(MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            status = &mut process_wait => {
                let status = status.map_err(|error| format!("等待文本编辑器退出失败: {}", error))?;
                if !status.success() {
                    return Err(format!("文本编辑器异常退出，状态码: {}", status));
                }
                break;
            }
            _ = poll.tick() => {
                let current_digest = match file_digest(&local_path) {
                    Ok(digest) => digest,
                    Err(error) => {
                        warn!("在线编辑期间读取临时文件失败，将重试: {}", error);
                        continue;
                    }
                };

                if current_digest != observed_digest {
                    observed_digest = current_digest;
                    observed_at = Instant::now();
                    continue;
                }

                let retry_ready = last_upload_attempt
                    .map(|attempt| attempt.elapsed() >= FAILED_UPLOAD_RETRY)
                    .unwrap_or(true);
                if observed_digest != last_synced_digest
                    && observed_at.elapsed() >= EDIT_SAVE_DEBOUNCE
                    && retry_ready
                {
                    last_upload_attempt = Some(Instant::now());
                    match sync_if_changed(&file_manager, &local_path, remote_path, &observed_digest).await {
                        Ok(()) => {
                            last_synced_digest = observed_digest.clone();
                            last_upload_error = None;
                            sync_count += 1;
                        }
                        Err(error) => {
                            warn!("{}", error);
                            last_upload_error = Some(error);
                        }
                    }
                }
            }
        }
    }

    // 编辑器退出和最后一次轮询之间可能又保存过，退出时做最终同步。
    let final_digest =
        file_digest(&local_path).map_err(|error| format!("读取编辑后的文件失败: {}", error))?;
    if final_digest != last_synced_digest {
        sync_if_changed(&file_manager, &local_path, remote_path, &final_digest)
            .await
            .map_err(|error| last_upload_error.unwrap_or(error))?;
        sync_count += 1;
    }

    Ok(EditFileResult {
        changed: sync_count > 0,
        uploaded: sync_count > 0,
        sync_count,
        editor_name: editor.display_name,
    })
}

#[command]
pub fn detect_local_editors() -> ApiResponse<Vec<DetectedEditor>> {
    ApiResponse::success(discover_local_editors())
}

#[command]
pub fn list_local_applications() -> ApiResponse<Vec<DetectedEditor>> {
    ApiResponse::success(discover_local_applications())
}

#[command]
pub fn inspect_local_editor(path: String) -> ApiResponse<DetectedEditor> {
    let configured = PathBuf::from(path.trim());
    let resolved = if editor_candidate_exists(&configured) {
        configured
    } else if let Some(path) = executable_on_path(configured.to_string_lossy().as_ref()) {
        path
    } else {
        return ApiResponse::error(format!(
            "选择的文本编辑器不存在或无法执行: {}",
            configured.display()
        ));
    };

    match editor_command_from_path(resolved.clone()) {
        Ok(command) => {
            let resolved = fs::canonicalize(&resolved).unwrap_or(resolved);
            ApiResponse::success(DetectedEditor {
                name: command.display_name,
                path: resolved.to_string_lossy().to_string(),
            })
        }
        Err(error) => ApiResponse::error(error),
    }
}

#[command]
pub async fn edit_file_with_local_editor(
    connection_id: String,
    remote_path: String,
    editor_path: Option<String>,
) -> ApiResponse<EditFileResult> {
    match edit_remote_file(&connection_id, &remote_path, editor_path).await {
        Ok(result) => ApiResponse::success(result),
        Err(error) => ApiResponse::error(error),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        discover_local_applications, discover_local_editors, editor_candidate_exists,
        editor_kind_from_name, editor_prefix_args, is_likely_text_editor_application,
        is_native_default_editor, sanitize_file_name, EditorKind,
    };
    use std::path::Path;

    #[test]
    fn preserves_extension_while_sanitizing_remote_file_name() {
        assert_eq!(sanitize_file_name("/docs/a:b?.txt"), "a_b_.txt");
    }

    #[test]
    fn vscode_is_started_in_wait_mode() {
        assert_eq!(editor_prefix_args(Path::new("Code.exe")), vec!["--wait"]);
        assert_eq!(editor_prefix_args(Path::new("Notepad3.exe")), vec!["/n"]);
        assert!(editor_prefix_args(Path::new("notepad.exe")).is_empty());
    }

    #[test]
    fn recognizes_supported_editor_install_names() {
        assert_eq!(
            editor_kind_from_name("Microsoft Visual Studio Code (User)"),
            Some(EditorKind::VisualStudioCode)
        );
        assert_eq!(
            editor_kind_from_name("Notepad3 (64-bit x64)"),
            Some(EditorKind::Notepad3)
        );
        assert_eq!(editor_kind_from_name("Some IDE"), None);
        assert_eq!(
            editor_kind_from_name("TextEdit.app"),
            Some(EditorKind::TextEdit)
        );
    }

    #[test]
    fn only_operating_system_native_editor_is_added_by_default() {
        #[cfg(target_os = "windows")]
        {
            assert!(is_native_default_editor(EditorKind::Notepad));
            assert!(!is_native_default_editor(EditorKind::Notepad3));
            assert!(!is_native_default_editor(EditorKind::VisualStudioCode));
        }
        #[cfg(target_os = "macos")]
        {
            assert!(is_native_default_editor(EditorKind::TextEdit));
            assert!(!is_native_default_editor(EditorKind::VisualStudioCode));
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            assert!(!is_native_default_editor(EditorKind::VisualStudioCode));
        }
    }

    #[test]
    fn filters_installed_applications_to_text_editors() {
        for editor in [
            "Code.exe",
            "Notepad++.exe",
            "Cursor.exe",
            "Sublime Text.app",
            "CotEditor.app",
            "BBEdit.app",
        ] {
            assert!(
                is_likely_text_editor_application(Path::new(editor)),
                "{editor}"
            );
        }
        for unrelated_application in ["chrome.exe", "Spotify.exe", "Microsoft Word.app", "VLC.app"]
        {
            assert!(
                !is_likely_text_editor_application(Path::new(unrelated_application)),
                "{unrelated_application}"
            );
        }
    }

    #[test]
    fn discovered_editor_paths_exist() {
        for editor in discover_local_editors() {
            assert!(
                editor_candidate_exists(Path::new(&editor.path)),
                "{}",
                editor.path
            );
        }
    }

    #[test]
    fn discovered_application_paths_exist() {
        for application in discover_local_applications() {
            assert!(
                editor_candidate_exists(Path::new(&application.path)),
                "{}",
                application.path
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn extracts_executable_from_registry_display_icon() {
        assert_eq!(
            super::registry_value_executable_path(r#""C:\Program Files\Editor\Code.exe",0"#),
            Some(Path::new(r"C:\Program Files\Editor\Code.exe").to_path_buf())
        );
    }
}
