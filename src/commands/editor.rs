use std::collections::{HashMap, HashSet};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use log::{info, warn};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{command, AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tokio::process::Command;
use uuid::Uuid;

use crate::core::edit_session::RemoteFingerprint;
use crate::core::editor_registry::{editor_id_for_path, EditorRegistry};
use crate::core::file::FileManager;
use crate::protocols::create_protocol;

use super::types::ApiResponse;
use super::utils::get_connection_config;

const SESSION_MANIFEST_FILE: &str = "session.json";
const MISSING_LOCAL_CONFIRMATION_DELAY: Duration = Duration::from_millis(250);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditSessionResult {
    pub session_id: String,
    pub connection_id: String,
    pub remote_path: String,
    pub file_name: String,
    pub editor_name: String,
    pub status: EditSessionStatus,
    pub changed: bool,
    pub uploaded: bool,
    pub dirty: bool,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedEditor {
    pub id: String,
    pub name: String,
    pub removable: bool,
    pub legacy_default: bool,
}

#[derive(Clone, Debug)]
struct EditorDescriptor {
    editor: DetectedEditor,
    path: PathBuf,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EditSessionStatus {
    Editing,
    Conflict,
    UploadFailed,
    Completed,
    Abandoned,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EditSessionRecord {
    session_id: String,
    connection_id: String,
    remote_path: String,
    file_name: String,
    #[serde(default)]
    editor_id: String,
    editor_name: String,
    local_path: PathBuf,
    baseline_digest: Vec<u8>,
    baseline_remote: RemoteFingerprint,
    status: EditSessionStatus,
    error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredEditor {
    id: String,
    name: String,
    path: PathBuf,
}

static EDITOR_REGISTRY: OnceLock<Mutex<EditorRegistry>> = OnceLock::new();
static EDIT_SESSIONS: OnceLock<Mutex<HashMap<String, EditSessionRecord>>> = OnceLock::new();
static SESSION_OPERATIONS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static SESSION_RESTORE_GATE: OnceLock<Mutex<SessionRestoreGate>> = OnceLock::new();

#[derive(Default)]
struct SessionRestoreGate {
    restored: bool,
}

impl SessionRestoreGate {
    fn complete(&mut self) {
        self.restored = true;
    }
}

fn restore_once(
    gate: &Mutex<SessionRestoreGate>,
    restore: impl FnOnce() -> Result<(), String>,
) -> Result<bool, String> {
    let mut guard = gate
        .lock()
        .map_err(|_| "编辑会话恢复锁已损坏".to_string())?;
    if guard.restored {
        return Ok(false);
    }
    restore()?;
    guard.complete();
    Ok(true)
}

fn editor_registry() -> &'static Mutex<EditorRegistry> {
    EDITOR_REGISTRY.get_or_init(|| Mutex::new(EditorRegistry::default()))
}

fn edit_sessions() -> &'static Mutex<HashMap<String, EditSessionRecord>> {
    EDIT_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_active_session(status: EditSessionStatus) -> bool {
    matches!(
        status,
        EditSessionStatus::Editing | EditSessionStatus::Conflict | EditSessionStatus::UploadFailed
    )
}

fn local_copy_is_present(path: &Path) -> Result<bool, String> {
    match fs::metadata(path) {
        Ok(metadata) => Ok(metadata.is_file()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!(
            "检查编辑会话本地副本失败 {}: {}",
            path.display(),
            error
        )),
    }
}

async fn retire_confirmed_missing_sessions(
    sessions: &Mutex<HashMap<String, EditSessionRecord>>,
    connection_id: Option<&str>,
    remote_path: Option<&str>,
    confirmation_delay: Duration,
) -> Result<(), String> {
    let candidates: Vec<_> = sessions
        .lock()
        .map_err(|_| "编辑会话锁已损坏".to_string())?
        .values()
        .filter(|session| {
            is_active_session(session.status)
                && connection_id
                    .map(|id| id == session.connection_id)
                    .unwrap_or(true)
                && remote_path
                    .map(|path| path == session.remote_path)
                    .unwrap_or(true)
        })
        .cloned()
        .collect();

    retire_confirmed_missing_candidates(sessions, candidates, confirmation_delay).await
}

async fn retire_confirmed_missing_candidates(
    sessions: &Mutex<HashMap<String, EditSessionRecord>>,
    candidates: Vec<EditSessionRecord>,
    confirmation_delay: Duration,
) -> Result<(), String> {
    for record in candidates {
        if local_copy_is_present(&record.local_path)? {
            continue;
        }
        let _operation = match claim_session_operation(&record.session_id) {
            Ok(operation) => operation,
            Err(_) => continue,
        };
        let still_active = sessions
            .lock()
            .map_err(|_| "编辑会话锁已损坏".to_string())?
            .get(&record.session_id)
            .is_some_and(|current| {
                is_active_session(current.status) && current.local_path == record.local_path
            });
        if !still_active {
            continue;
        }
        tokio::time::sleep(confirmation_delay).await;
        if local_copy_is_present(&record.local_path)? {
            continue;
        }
        let still_active = sessions
            .lock()
            .map_err(|_| "编辑会话锁已损坏".to_string())?
            .get(&record.session_id)
            .is_some_and(|current| {
                is_active_session(current.status) && current.local_path == record.local_path
            });
        if !still_active {
            continue;
        }
        let mut retired = record.clone();
        retired.status = EditSessionStatus::Abandoned;
        retired.error = Some("本地编辑副本已确认丢失，旧会话已结束".to_string());
        persist_session(&retired)?;
        let mut sessions = sessions
            .lock()
            .map_err(|_| "编辑会话锁已损坏".to_string())?;
        if sessions.get(&record.session_id).is_some_and(|current| {
            is_active_session(current.status) && current.local_path == record.local_path
        }) {
            sessions.remove(&record.session_id);
        }
    }
    Ok(())
}

struct SessionOperationGuard {
    session_id: String,
}

impl Drop for SessionOperationGuard {
    fn drop(&mut self) {
        if let Ok(mut operations) = SESSION_OPERATIONS
            .get_or_init(|| Mutex::new(HashSet::new()))
            .lock()
        {
            operations.remove(&self.session_id);
        }
    }
}

fn claim_session_operation(session_id: &str) -> Result<SessionOperationGuard, String> {
    let mut operations = SESSION_OPERATIONS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map_err(|_| "编辑会话操作锁已损坏".to_string())?;
    if !operations.insert(session_id.to_string()) {
        return Err("该编辑会话正在处理，请稍候".to_string());
    }
    Ok(SessionOperationGuard {
        session_id: session_id.to_string(),
    })
}

struct ProvisionalSessionDirectory {
    path: PathBuf,
    keep: bool,
}

impl ProvisionalSessionDirectory {
    fn new(path: PathBuf) -> Self {
        Self { path, keep: false }
    }

    fn keep(&mut self) {
        self.keep = true;
    }
}

impl Drop for ProvisionalSessionDirectory {
    fn drop(&mut self) {
        if !self.keep {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

fn editor_descriptor(name: String, path: PathBuf, removable: bool) -> EditorDescriptor {
    EditorDescriptor {
        editor: DetectedEditor {
            id: editor_id_for_path(&path),
            name,
            removable,
            legacy_default: false,
        },
        path,
    }
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

    #[cfg(target_os = "windows")]
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

    if name == "notepad3" {
        // Notepad3 can be configured to reuse an existing window. /n forces a
        // dedicated process so the process lifetime reliably bounds this edit session.
        vec!["/n".to_string()]
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
                    prefix_args: Vec::new(),
                    display_name: kind
                        .map(EditorKind::display_name)
                        .unwrap_or("Editor")
                        .to_string(),
                });
            }
        }

        return Ok(EditorCommand {
            executable: PathBuf::from("/usr/bin/open"),
            prefix_args: vec!["-a".to_string(), path.to_string_lossy().to_string()],
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

fn discover_local_applications() -> Vec<EditorDescriptor> {
    let mut paths: Vec<PathBuf> = discover_local_editors()
        .into_iter()
        .map(|editor| editor.path)
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
    let mut applications: Vec<EditorDescriptor> = paths
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
            Some(editor_descriptor(command.display_name, path, true))
        })
        .collect();

    applications.sort_by(|left, right| {
        left.editor
            .name
            .to_ascii_lowercase()
            .cmp(&right.editor.name.to_ascii_lowercase())
    });
    applications.truncate(100);
    applications
}

fn discover_local_editors() -> Vec<EditorDescriptor> {
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
    let mut editors: Vec<(EditorKind, EditorDescriptor)> = candidates
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
                editor_descriptor(kind.display_name().to_string(), path, false),
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

fn stored_editors_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join("editor-registry.json"))
        .map_err(|error| format!("获取编辑器配置目录失败: {}", error))
}

fn write_private_file_atomically(path: &Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建配置目录失败: {}", error))?;
    }
    let temporary = path.with_extension(format!("tmp-{}", Uuid::new_v4()));
    #[cfg(windows)]
    let backup = path.with_extension(format!("bak-{}", Uuid::new_v4()));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let write_result = (|| -> std::io::Result<()> {
        let mut file = options.open(&temporary)?;
        file.write_all(content)?;
        file.sync_all()?;
        #[cfg(windows)]
        {
            let had_destination = path.exists();
            if had_destination {
                fs::rename(path, &backup)?;
            }
            if let Err(error) = fs::rename(&temporary, path) {
                if had_destination {
                    let _ = fs::rename(&backup, path);
                }
                return Err(error);
            }
            if had_destination {
                let _ = fs::remove_file(&backup);
            }
        }
        #[cfg(not(windows))]
        {
            fs::rename(&temporary, path)?;
            if let Some(parent) = path.parent() {
                File::open(parent)?.sync_all()?;
            }
        }
        Ok(())
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary);
        return Err(format!("原子写入配置失败: {}", error));
    }
    Ok(())
}

fn load_stored_editors(app: &AppHandle) -> Vec<StoredEditor> {
    let Ok(path) = stored_editors_path(app) else {
        return Vec::new();
    };
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&content).unwrap_or_else(|error| {
        warn!("读取编辑器注册表失败: {}", error);
        Vec::new()
    })
}

fn save_stored_editors(app: &AppHandle, editors: &[StoredEditor]) -> Result<(), String> {
    let path = stored_editors_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建编辑器配置目录失败: {}", error))?;
    }
    let content = serde_json::to_vec_pretty(editors)
        .map_err(|error| format!("序列化编辑器配置失败: {}", error))?;
    write_private_file_atomically(&path, &content)
        .map_err(|error| format!("保存编辑器配置失败: {}", error))
}

fn register_editor_descriptor(editor: &EditorDescriptor) {
    if let Ok(mut registry) = editor_registry().lock() {
        registry.register(&editor.editor.name, editor.path.clone());
    }
}

fn legacy_editor_paths(app: &AppHandle) -> (Option<PathBuf>, Vec<PathBuf>) {
    let path = app
        .path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join("editor-settings.json"));
    let Some(path) = path else {
        return (None, Vec::new());
    };
    let Ok(content) = fs::read(path) else {
        return (None, Vec::new());
    };
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&content) else {
        return (None, Vec::new());
    };
    let default = value
        .get("defaultEditorPath")
        .or_else(|| value.get("executablePath"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);
    let custom = value
        .get("customEditors")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
        .filter_map(|editor| editor.get("path").and_then(|path| path.as_str()))
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from)
        .collect();
    (default, custom)
}

fn configured_editors(app: &AppHandle) -> Vec<DetectedEditor> {
    let mut editors = discover_local_editors();
    editors.extend(load_stored_editors(app).into_iter().filter_map(|stored| {
        editor_candidate_exists(&stored.path)
            .then(|| editor_descriptor(stored.name, stored.path, true))
    }));
    let (legacy_default, mut legacy_custom) = legacy_editor_paths(app);
    if let Some(default) = legacy_default.clone() {
        legacy_custom.push(default);
    }
    if !legacy_custom.is_empty() {
        let known_applications = discover_local_applications();
        for legacy_path in legacy_custom {
            let legacy_path = fs::canonicalize(&legacy_path).unwrap_or(legacy_path);
            if let Some(descriptor) = known_applications
                .iter()
                .find(|descriptor| descriptor.path == legacy_path)
            {
                if !editors
                    .iter()
                    .any(|editor| editor.editor.id == descriptor.editor.id)
                {
                    let _ = persist_registered_editor(app, descriptor);
                    editors.push(descriptor.clone());
                }
            }
        }
    }
    let legacy_default = legacy_default.map(|path| fs::canonicalize(&path).unwrap_or(path));
    let mut seen = HashSet::new();
    editors.retain(|editor| seen.insert(editor.editor.id.clone()));
    for descriptor in &mut editors {
        descriptor.editor.legacy_default = legacy_default
            .as_ref()
            .is_some_and(|path| descriptor.path == *path);
    }
    for editor in &editors {
        register_editor_descriptor(editor);
    }
    editors
        .into_iter()
        .map(|descriptor| descriptor.editor)
        .collect()
}

fn resolve_editor(app: &AppHandle, editor_id: &str) -> Result<EditorCommand, String> {
    let _ = configured_editors(app);
    let path = editor_registry()
        .lock()
        .map_err(|_| "编辑器注册表锁已损坏".to_string())?
        .resolve(editor_id)
        .map(Path::to_path_buf)
        .ok_or_else(|| "编辑器未由后端登记，请重新选择编辑器".to_string())?;
    editor_command_from_path(path)
}

fn persist_registered_editor(app: &AppHandle, editor: &EditorDescriptor) -> Result<(), String> {
    let mut stored = load_stored_editors(app);
    stored.retain(|item| item.id != editor.editor.id);
    stored.push(StoredEditor {
        id: editor.editor.id.clone(),
        name: editor.editor.name.clone(),
        path: editor.path.clone(),
    });
    save_stored_editors(app, &stored)
}

fn session_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join("edit-sessions"))
        .map_err(|error| format!("获取编辑会话目录失败: {}", error))
}

fn create_secure_session_directory(app: &AppHandle, session_id: &str) -> Result<PathBuf, String> {
    let directory = session_root(app)?.join(session_id);
    fs::create_dir_all(&directory).map_err(|error| format!("创建编辑会话目录失败: {}", error))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("限制编辑会话目录权限失败: {}", error))?;
    }
    Ok(directory)
}

fn persist_session(record: &EditSessionRecord) -> Result<(), String> {
    let manifest = record
        .local_path
        .parent()
        .ok_or_else(|| "编辑会话路径无效".to_string())?
        .join(SESSION_MANIFEST_FILE);
    let content = serde_json::to_vec_pretty(record)
        .map_err(|error| format!("序列化编辑会话失败: {}", error))?;
    write_private_file_atomically(&manifest, &content)
        .map_err(|error| format!("保存编辑会话失败: {}", error))
}

fn remove_restored_session_directory(directory: &Path, reason: &str) {
    if let Err(error) = fs::remove_dir_all(directory) {
        warn!(
            "{}，但清理目录失败 {}: {}",
            reason,
            directory.display(),
            error
        );
    }
}

fn scan_session_records(root: &Path) -> Result<Vec<EditSessionRecord>, String> {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(format!(
                "读取编辑会话目录失败 {}: {}",
                root.display(),
                error
            ));
        }
    };
    let mut restored = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("读取编辑会话目录项失败: {}", error))?;
        let directory = entry.path();
        let manifest = directory.join(SESSION_MANIFEST_FILE);
        let content = match fs::read_to_string(&manifest) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                warn!("清理缺少有效清单的编辑会话目录: {}", directory.display());
                remove_restored_session_directory(&directory, "编辑会话缺少有效清单");
                continue;
            }
            Err(error) => {
                return Err(format!(
                    "读取编辑会话清单失败 {}: {}",
                    manifest.display(),
                    error
                ));
            }
        };
        let Ok(record) = serde_json::from_str::<EditSessionRecord>(&content) else {
            warn!("清理清单损坏的编辑会话目录: {}", directory.display());
            remove_restored_session_directory(&directory, "编辑会话清单损坏");
            continue;
        };
        let directory_name_matches = directory
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name == record.session_id);
        let local_parent_matches = directory
            .canonicalize()
            .ok()
            .zip(
                record
                    .local_path
                    .parent()
                    .and_then(|parent| parent.canonicalize().ok()),
            )
            .is_some_and(|(expected, actual)| expected == actual);
        if !directory_name_matches || !local_parent_matches {
            warn!("忽略路径不可信的编辑会话清单: {}", manifest.display());
            remove_restored_session_directory(&directory, "编辑会话清单路径不可信");
            continue;
        }
        if matches!(
            record.status,
            EditSessionStatus::Completed | EditSessionStatus::Abandoned
        ) {
            remove_restored_session_directory(&directory, "编辑会话已结束");
            continue;
        }
        match fs::metadata(&record.local_path) {
            Ok(metadata) if metadata.is_file() => restored.push(record),
            Ok(_) => {
                warn!("编辑会话本地副本暂不可用: {}", record.local_path.display());
                restored.push(record);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                warn!("编辑会话本地副本暂时缺失: {}", record.local_path.display());
                restored.push(record);
            }
            Err(error) => {
                return Err(format!(
                    "检查编辑会话本地副本失败 {}: {}",
                    record.local_path.display(),
                    error
                ));
            }
        }
    }
    Ok(restored)
}

fn restore_sessions(app: &AppHandle) -> Result<(), String> {
    restore_once(
        SESSION_RESTORE_GATE.get_or_init(|| Mutex::new(SessionRestoreGate::default())),
        || {
            let root = session_root(app)?;
            let restored = scan_session_records(&root)?;
            let mut sessions = edit_sessions()
                .lock()
                .map_err(|_| "编辑会话锁已损坏".to_string())?;
            for record in restored {
                sessions.entry(record.session_id.clone()).or_insert(record);
            }
            Ok(())
        },
    )?;
    Ok(())
}

fn cleanup_session(record: &EditSessionRecord) {
    if let Ok(mut sessions) = edit_sessions().lock() {
        sessions.insert(record.session_id.clone(), record.clone());
    }
    if let Err(error) = persist_session(record) {
        warn!(
            "写入编辑会话终态 {} 失败，保留内存终态以避免重复提交: {}",
            record.session_id, error
        );
        return;
    }
    if let Some(directory) = record.local_path.parent() {
        if let Err(error) = fs::remove_dir_all(directory) {
            warn!("清理编辑会话 {} 失败: {}", record.session_id, error);
        }
    }
    if let Ok(mut sessions) = edit_sessions().lock() {
        sessions.remove(&record.session_id);
    }
}

async fn digest_async(path: PathBuf) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || file_digest(&path))
        .await
        .map_err(|error| format!("读取编辑文件任务失败: {}", error))?
        .map_err(|error| format!("读取编辑文件失败: {}", error))
}

struct EditSnapshot {
    path: PathBuf,
    digest: Vec<u8>,
}

impl Drop for EditSnapshot {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn copy_and_digest_stable(source: &Path, destination: &Path) -> std::io::Result<Option<Vec<u8>>> {
    let before = fs::metadata(source)?;
    let mut input = File::open(source)?;
    let mut output = File::create(destination)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(destination, fs::Permissions::from_mode(0o600))?;
    }
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = input.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        output.write_all(&buffer[..read])?;
        hasher.update(&buffer[..read]);
    }
    output.flush()?;
    let after = fs::metadata(source)?;
    if before.len() != after.len()
        || before.modified().ok() != after.modified().ok()
        || fs::metadata(destination)?.len() != after.len()
    {
        return Ok(None);
    }
    Ok(Some(hasher.finalize().to_vec()))
}

async fn create_stable_snapshot(path: PathBuf) -> Result<EditSnapshot, String> {
    let directory = path
        .parent()
        .ok_or_else(|| "编辑会话路径无效".to_string())?
        .to_path_buf();
    let first_path = directory.join(".commit-check.snapshot");
    let final_path = directory.join(".commit.snapshot");
    for _ in 0..5 {
        let source = path.clone();
        let first = first_path.clone();
        let first_digest =
            tokio::task::spawn_blocking(move || copy_and_digest_stable(&source, &first))
                .await
                .map_err(|error| format!("创建编辑快照任务失败: {}", error))?
                .map_err(|error| format!("创建编辑快照失败: {}", error))?;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let source = path.clone();
        let final_candidate = final_path.clone();
        let final_digest =
            tokio::task::spawn_blocking(move || copy_and_digest_stable(&source, &final_candidate))
                .await
                .map_err(|error| format!("创建编辑快照任务失败: {}", error))?
                .map_err(|error| format!("创建编辑快照失败: {}", error))?;
        if let (Some(first_digest), Some(final_digest)) = (first_digest, final_digest) {
            if first_digest == final_digest {
                let _ = fs::remove_file(&first_path);
                return Ok(EditSnapshot {
                    path: final_path,
                    digest: final_digest,
                });
            }
        }
        let _ = fs::remove_file(&first_path);
        let _ = fs::remove_file(&final_path);
    }
    Err("编辑文件仍在写入，请稍后重试完成编辑".to_string())
}

fn create_file_manager(connection_id: &str) -> Result<FileManager, String> {
    let (protocol_type, config) = get_connection_config(connection_id)?;
    let protocol = create_protocol(&protocol_type, &config)
        .map_err(|error| format!("创建协议失败: {}", error))?;
    let operator = protocol
        .create_operator()
        .map_err(|error| format!("创建操作符失败: {}", error))?;
    Ok(FileManager::new(operator))
}

fn session_result(
    record: &EditSessionRecord,
    current_digest: &[u8],
    uploaded: bool,
) -> EditSessionResult {
    EditSessionResult {
        session_id: record.session_id.clone(),
        connection_id: record.connection_id.clone(),
        remote_path: record.remote_path.clone(),
        file_name: record.file_name.clone(),
        editor_name: record.editor_name.clone(),
        status: record.status,
        changed: current_digest != record.baseline_digest,
        uploaded,
        dirty: current_digest != record.baseline_digest,
        error: record.error.clone(),
    }
}

async fn start_session(
    app: &AppHandle,
    connection_id: &str,
    remote_path: &str,
    editor_id: &str,
) -> Result<EditSessionResult, String> {
    restore_sessions(app)?;
    retire_confirmed_missing_sessions(
        edit_sessions(),
        Some(connection_id),
        Some(remote_path),
        MISSING_LOCAL_CONFIRMATION_DELAY,
    )
    .await?;
    let has_active_session = {
        let sessions = edit_sessions()
            .lock()
            .map_err(|_| "编辑会话锁已损坏".to_string())?;
        sessions.values().any(|session| {
            session.connection_id == connection_id
                && session.remote_path == remote_path
                && is_active_session(session.status)
        })
    };
    if has_active_session {
        return Err("该远端文件已有活动编辑会话".to_string());
    }

    let editor = resolve_editor(app, editor_id)?;
    let file_manager = create_file_manager(connection_id)?;
    let baseline_before = file_manager
        .remote_fingerprint(remote_path)
        .await
        .map_err(|error| format!("获取远端文件版本失败: {}", error))?;
    let session_id = Uuid::new_v4().to_string();
    let directory = create_secure_session_directory(app, &session_id)?;
    let mut directory_guard = ProvisionalSessionDirectory::new(directory.clone());
    let local_path = directory.join(sanitize_file_name(remote_path));
    file_manager
        .download(remote_path, &local_path)
        .await
        .map_err(|error| format!("下载待编辑文件失败: {}", error))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&local_path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("限制编辑文件权限失败: {}", error))?;
    }
    let baseline_after = file_manager
        .remote_fingerprint(remote_path)
        .await
        .map_err(|error| format!("重新检查远端文件版本失败: {}", error))?;
    if !baseline_before.matches(&baseline_after) {
        return Err("下载期间远端文件发生变化，请重试".to_string());
    }
    let baseline_digest = digest_async(local_path.clone()).await?;
    if !baseline_after.has_strong_identity() {
        let remote_digest = file_manager
            .remote_digest(remote_path)
            .await
            .map_err(|error| format!("校验远端文件内容失败: {}", error))?;
        if remote_digest != baseline_digest {
            return Err("下载期间远端文件内容发生变化，请重试".to_string());
        }
    }
    let record = EditSessionRecord {
        session_id: session_id.clone(),
        connection_id: connection_id.to_string(),
        remote_path: remote_path.to_string(),
        file_name: sanitize_file_name(remote_path),
        editor_id: editor_id.to_string(),
        editor_name: editor.display_name.clone(),
        local_path: local_path.clone(),
        baseline_digest: baseline_digest.clone(),
        baseline_remote: baseline_after,
        status: EditSessionStatus::Editing,
        error: None,
    };
    persist_session(&record)?;
    {
        retire_confirmed_missing_sessions(
            edit_sessions(),
            Some(connection_id),
            Some(remote_path),
            MISSING_LOCAL_CONFIRMATION_DELAY,
        )
        .await?;
        let mut sessions = edit_sessions()
            .lock()
            .map_err(|_| "编辑会话锁已损坏".to_string())?;
        if sessions.values().any(|session| {
            session.connection_id == connection_id
                && session.remote_path == remote_path
                && is_active_session(session.status)
        }) {
            return Err("该远端文件已有活动编辑会话".to_string());
        }
        sessions.insert(session_id.clone(), record.clone());
    }
    if let Err(error) = Command::new(&editor.executable)
        .args(&editor.prefix_args)
        .arg(&local_path)
        .spawn()
    {
        if let Ok(mut sessions) = edit_sessions().lock() {
            sessions.remove(&session_id);
        }
        return Err(format!("启动文本编辑器失败: {}", error));
    }

    directory_guard.keep();

    Ok(session_result(&record, &baseline_digest, false))
}

async fn finish_session(
    app: &AppHandle,
    session_id: &str,
    mode: &str,
    save_as_path: Option<String>,
) -> Result<EditSessionResult, String> {
    restore_sessions(app)?;
    let _operation = claim_session_operation(session_id)?;
    let mut record = edit_sessions()
        .lock()
        .map_err(|_| "编辑会话锁已损坏".to_string())?
        .get(session_id)
        .cloned()
        .ok_or_else(|| "编辑会话不存在或已结束".to_string())?;
    let snapshot = create_stable_snapshot(record.local_path.clone()).await?;
    let current_digest = &snapshot.digest;
    if *current_digest == record.baseline_digest {
        record.status = EditSessionStatus::Completed;
        record.error = None;
        let result = session_result(&record, current_digest, false);
        cleanup_session(&record);
        return Ok(result);
    }

    let file_manager = create_file_manager(&record.connection_id)?;
    let target_path = save_as_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .unwrap_or(&record.remote_path)
        .to_string();
    if mode == "normal" {
        let remote_exists = file_manager
            .path_exists(&record.remote_path)
            .await
            .map_err(|error| format!("检查远端文件失败，请检查连接后重试: {}", error))?
            .0;
        if !remote_exists {
            record.status = EditSessionStatus::Conflict;
            record.error = Some("远端文件已被删除或移动".to_string());
            persist_session(&record)?;
            edit_sessions()
                .lock()
                .map_err(|_| "编辑会话锁已损坏".to_string())?
                .insert(session_id.to_string(), record.clone());
            return Ok(session_result(&record, current_digest, false));
        }
        let current_remote = match file_manager.remote_fingerprint(&record.remote_path).await {
            Ok(fingerprint) => fingerprint,
            Err(error) => {
                record.status = EditSessionStatus::UploadFailed;
                record.error = Some(format!("无法确认远端版本，请检查连接后重试: {}", error));
                persist_session(&record)?;
                edit_sessions()
                    .lock()
                    .map_err(|_| "编辑会话锁已损坏".to_string())?
                    .insert(session_id.to_string(), record.clone());
                return Ok(session_result(&record, current_digest, false));
            }
        };
        let remote_unchanged = if record.baseline_remote.has_strong_identity() {
            record.baseline_remote.matches(&current_remote)
        } else {
            match file_manager.remote_digest(&record.remote_path).await {
                Ok(digest) => digest == record.baseline_digest,
                Err(error) => {
                    record.status = EditSessionStatus::UploadFailed;
                    record.error =
                        Some(format!("无法校验远端文件内容，请检查连接后重试: {}", error));
                    persist_session(&record)?;
                    edit_sessions()
                        .lock()
                        .map_err(|_| "编辑会话锁已损坏".to_string())?
                        .insert(session_id.to_string(), record.clone());
                    return Ok(session_result(&record, current_digest, false));
                }
            }
        };
        if !remote_unchanged {
            record.status = EditSessionStatus::Conflict;
            record.error = Some("远端文件在编辑期间已发生变化".to_string());
            persist_session(&record)?;
            edit_sessions()
                .lock()
                .map_err(|_| "编辑会话锁已损坏".to_string())?
                .insert(session_id.to_string(), record.clone());
            return Ok(session_result(&record, current_digest, false));
        }
        if !file_manager.supports_safe_edit_commit(&record.baseline_remote, false) {
            record.status = EditSessionStatus::Conflict;
            record.error = Some(
                "当前存储不支持条件写入；为避免静默覆盖远端更新，请明确选择覆盖远端或另存为"
                    .to_string(),
            );
            persist_session(&record)?;
            edit_sessions()
                .lock()
                .map_err(|_| "编辑会话锁已损坏".to_string())?
                .insert(session_id.to_string(), record.clone());
            return Ok(session_result(&record, current_digest, false));
        }
    } else if mode == "saveAs" {
        if target_path == record.remote_path {
            return Err("另存为路径必须与原文件不同".to_string());
        }
        if !file_manager.supports_safe_create() {
            return Err(
                "当前存储不支持原子另存为；编辑副本仍保留，请改用支持条件创建的存储或明确覆盖原文件"
                    .to_string(),
            );
        }
        let (exists, _) = file_manager
            .path_exists(&target_path)
            .await
            .map_err(|error| format!("检查另存为路径失败: {}", error))?;
        if exists {
            record.status = EditSessionStatus::Conflict;
            record.error = Some("另存为目标已存在".to_string());
            persist_session(&record)?;
            edit_sessions()
                .lock()
                .map_err(|_| "编辑会话锁已损坏".to_string())?
                .insert(session_id.to_string(), record.clone());
            return Ok(session_result(&record, current_digest, false));
        }
    } else if mode != "overwrite" {
        return Err("不支持的编辑完成模式".to_string());
    }

    let expected_remote = (mode == "normal").then_some(&record.baseline_remote);
    match file_manager
        .replace_from_local_if_unchanged(
            &snapshot.path,
            &target_path,
            &record.session_id,
            expected_remote,
            Some(&record.baseline_digest),
            mode == "saveAs",
        )
        .await
    {
        Ok(true) => {
            record.status = EditSessionStatus::Completed;
            record.error = None;
            info!("编辑会话已提交: {} -> {}", session_id, target_path);
        }
        Ok(false) => {
            record.status = EditSessionStatus::Conflict;
            record.error = Some(if mode == "saveAs" {
                "另存为目标已存在".to_string()
            } else {
                "远端文件在提交前再次发生变化".to_string()
            });
        }
        Err(error) => {
            record.status = EditSessionStatus::UploadFailed;
            record.error = Some(format!("上传编辑结果失败: {}", error));
        }
    }
    let result = session_result(
        &record,
        current_digest,
        record.status == EditSessionStatus::Completed,
    );
    if record.status == EditSessionStatus::Completed {
        cleanup_session(&record);
    } else {
        persist_session(&record)?;
        edit_sessions()
            .lock()
            .map_err(|_| "编辑会话锁已损坏".to_string())?
            .insert(session_id.to_string(), record.clone());
    }
    Ok(result)
}

async fn reopen_session(
    app: &AppHandle,
    session_id: &str,
    editor_id: Option<String>,
) -> Result<EditSessionResult, String> {
    restore_sessions(app)?;
    let _operation = claim_session_operation(session_id)?;
    let mut record = edit_sessions()
        .lock()
        .map_err(|_| "编辑会话锁已损坏".to_string())?
        .get(session_id)
        .cloned()
        .ok_or_else(|| "编辑会话不存在或已结束".to_string())?;
    if !matches!(
        record.status,
        EditSessionStatus::Editing | EditSessionStatus::Conflict | EditSessionStatus::UploadFailed
    ) {
        return Err("编辑会话已结束".to_string());
    }
    let editor_id = editor_id
        .filter(|id| !id.trim().is_empty())
        .or_else(|| (!record.editor_id.is_empty()).then(|| record.editor_id.clone()))
        .ok_or_else(|| "原编辑器信息不可用，请重新选择编辑器".to_string())?;
    let editor = resolve_editor(app, &editor_id)?;
    Command::new(&editor.executable)
        .args(&editor.prefix_args)
        .arg(&record.local_path)
        .spawn()
        .map_err(|error| format!("重新打开文本编辑器失败: {}", error))?;
    record.editor_id = editor_id;
    record.editor_name = editor.display_name;
    record.status = EditSessionStatus::Editing;
    record.error = None;
    persist_session(&record)?;
    edit_sessions()
        .lock()
        .map_err(|_| "编辑会话锁已损坏".to_string())?
        .insert(session_id.to_string(), record.clone());
    let digest = digest_async(record.local_path.clone()).await?;
    Ok(session_result(&record, &digest, false))
}

#[command]
pub fn detect_local_editors(app: AppHandle) -> ApiResponse<Vec<DetectedEditor>> {
    ApiResponse::success(configured_editors(&app))
}

#[command]
pub fn list_local_applications() -> ApiResponse<Vec<DetectedEditor>> {
    let applications = discover_local_applications();
    for application in &applications {
        register_editor_descriptor(application);
    }
    ApiResponse::success(
        applications
            .into_iter()
            .map(|descriptor| descriptor.editor)
            .collect(),
    )
}

#[command]
pub fn register_detected_editor(app: AppHandle, editor_id: String) -> ApiResponse<DetectedEditor> {
    let editor = discover_local_applications()
        .into_iter()
        .find(|editor| editor.editor.id == editor_id);
    match editor {
        Some(editor) => match persist_registered_editor(&app, &editor) {
            Ok(()) => {
                register_editor_descriptor(&editor);
                ApiResponse::success(editor.editor)
            }
            Err(error) => ApiResponse::error(error),
        },
        None => ApiResponse::error("编辑器候选 ID 无效".to_string()),
    }
}

#[command]
pub async fn choose_and_register_local_editor(app: AppHandle) -> ApiResponse<DetectedEditor> {
    let dialog_app = app.clone();
    let selected = tokio::task::spawn_blocking(move || {
        let builder = dialog_app
            .dialog()
            .file()
            .set_title("选择文本编辑器应用或可执行文件");
        #[cfg(target_os = "windows")]
        let builder = builder.add_filter("Applications", &["exe"]);
        builder.blocking_pick_file()
    })
    .await;
    let selected = match selected {
        Ok(Some(path)) => match path.into_path() {
            Ok(path) => path,
            Err(error) => return ApiResponse::error(format!("读取编辑器路径失败: {}", error)),
        },
        Ok(None) => return ApiResponse::error("用户取消选择编辑器".to_string()),
        Err(error) => return ApiResponse::error(format!("打开编辑器选择器失败: {}", error)),
    };
    if !editor_candidate_exists(&selected) {
        return ApiResponse::error("选择的编辑器不存在".to_string());
    }
    let selected = fs::canonicalize(&selected).unwrap_or(selected);
    let command = match editor_command_from_path(selected.clone()) {
        Ok(command) => command,
        Err(error) => return ApiResponse::error(error),
    };
    let editor = editor_descriptor(command.display_name, selected, true);
    match persist_registered_editor(&app, &editor) {
        Ok(()) => {
            register_editor_descriptor(&editor);
            ApiResponse::success(editor.editor)
        }
        Err(error) => ApiResponse::error(error),
    }
}

#[command]
pub fn remove_registered_editor(app: AppHandle, editor_id: String) -> ApiResponse<bool> {
    let mut stored = load_stored_editors(&app);
    let before = stored.len();
    stored.retain(|editor| editor.id != editor_id);
    if before == stored.len() {
        return ApiResponse::error("只能移除用户添加的编辑器".to_string());
    }
    match save_stored_editors(&app, &stored) {
        Ok(()) => {
            if let Ok(mut registry) = editor_registry().lock() {
                registry.remove(&editor_id);
            }
            ApiResponse::success(true)
        }
        Err(error) => ApiResponse::error(error),
    }
}

#[command]
pub async fn start_edit_session(
    app: AppHandle,
    connection_id: String,
    remote_path: String,
    editor_id: String,
) -> ApiResponse<EditSessionResult> {
    match start_session(&app, &connection_id, &remote_path, &editor_id).await {
        Ok(result) => ApiResponse::success(result),
        Err(error) => ApiResponse::error(error),
    }
}

#[command]
pub async fn list_edit_sessions(
    app: AppHandle,
    connection_id: Option<String>,
) -> ApiResponse<Vec<EditSessionResult>> {
    if let Err(error) = restore_sessions(&app) {
        return ApiResponse::error(error);
    }
    if let Err(error) = retire_confirmed_missing_sessions(
        edit_sessions(),
        connection_id.as_deref(),
        None,
        MISSING_LOCAL_CONFIRMATION_DELAY,
    )
    .await
    {
        return ApiResponse::error(error);
    }
    let records: Vec<_> = match edit_sessions().lock() {
        Ok(sessions) => sessions
            .values()
            .filter(|session| {
                connection_id
                    .as_deref()
                    .map(|id| id == session.connection_id)
                    .unwrap_or(true)
                    && is_active_session(session.status)
            })
            .cloned()
            .collect(),
        Err(_) => return ApiResponse::error("编辑会话锁已损坏".to_string()),
    };
    let mut results = Vec::new();
    for record in records {
        match digest_async(record.local_path.clone()).await {
            Ok(digest) => results.push(session_result(&record, &digest, false)),
            Err(error) => warn!("读取恢复编辑会话失败 {}: {}", record.session_id, error),
        }
    }
    ApiResponse::success(results)
}

#[command]
pub async fn finish_edit_session(
    app: AppHandle,
    session_id: String,
    mode: Option<String>,
    save_as_path: Option<String>,
) -> ApiResponse<EditSessionResult> {
    match finish_session(
        &app,
        &session_id,
        mode.as_deref().unwrap_or("normal"),
        save_as_path,
    )
    .await
    {
        Ok(result) => ApiResponse::success(result),
        Err(error) => ApiResponse::error(error),
    }
}

#[command]
pub async fn reopen_edit_session(
    app: AppHandle,
    session_id: String,
    editor_id: Option<String>,
) -> ApiResponse<EditSessionResult> {
    match reopen_session(&app, &session_id, editor_id).await {
        Ok(result) => ApiResponse::success(result),
        Err(error) => ApiResponse::error(error),
    }
}

#[command]
pub async fn abandon_edit_session(
    app: AppHandle,
    session_id: String,
) -> ApiResponse<EditSessionResult> {
    if let Err(error) = restore_sessions(&app) {
        return ApiResponse::error(error);
    }
    let _operation = match claim_session_operation(&session_id) {
        Ok(operation) => operation,
        Err(error) => return ApiResponse::error(error),
    };
    let mut record = match edit_sessions().lock() {
        Ok(sessions) => match sessions.get(&session_id).cloned() {
            Some(record) => record,
            None => return ApiResponse::error("编辑会话不存在或已结束".to_string()),
        },
        Err(_) => return ApiResponse::error("编辑会话锁已损坏".to_string()),
    };
    let digest = match digest_async(record.local_path.clone()).await {
        Ok(digest) => digest,
        Err(error) => return ApiResponse::error(error),
    };
    record.status = EditSessionStatus::Abandoned;
    record.error = None;
    let result = session_result(&record, &digest, false);
    cleanup_session(&record);
    ApiResponse::success(result)
}

#[cfg(test)]
mod tests {
    use super::{
        claim_session_operation, create_stable_snapshot, discover_local_applications,
        discover_local_editors, editor_candidate_exists, editor_kind_from_name, editor_prefix_args,
        file_digest, is_likely_text_editor_application, is_native_default_editor, restore_once,
        retire_confirmed_missing_candidates, retire_confirmed_missing_sessions, sanitize_file_name,
        scan_session_records, EditSessionRecord, EditSessionStatus, EditorKind,
        ProvisionalSessionDirectory, SessionRestoreGate, SESSION_MANIFEST_FILE,
    };
    use crate::core::edit_session::RemoteFingerprint;
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};
    use std::sync::{Mutex, TryLockError};
    use std::time::Duration;

    fn edit_session_record(local_path: PathBuf, status: EditSessionStatus) -> EditSessionRecord {
        EditSessionRecord {
            session_id: "session-id".to_string(),
            connection_id: "connection-id".to_string(),
            remote_path: "/remote/file.txt".to_string(),
            file_name: "file.txt".to_string(),
            editor_id: "editor-id".to_string(),
            editor_name: "Editor".to_string(),
            local_path,
            baseline_digest: Vec::new(),
            baseline_remote: RemoteFingerprint {
                etag: None,
                version: None,
                modified: None,
                size: 0,
            },
            status,
            error: None,
        }
    }

    #[test]
    fn preserves_extension_while_sanitizing_remote_file_name() {
        assert_eq!(sanitize_file_name("/docs/a:b?.txt"), "a_b_.txt");
    }

    #[test]
    fn explicit_sessions_do_not_wait_for_editor_process_exit() {
        assert!(editor_prefix_args(Path::new("Code.exe")).is_empty());
        assert_eq!(editor_prefix_args(Path::new("Notepad3.exe")), vec!["/n"]);
        assert!(editor_prefix_args(Path::new("notepad.exe")).is_empty());
        assert!(editor_prefix_args(Path::new("kate")).is_empty());
    }

    #[test]
    fn session_mutations_are_serialized() {
        let first = claim_session_operation("serialized-session").unwrap();
        assert!(claim_session_operation("serialized-session").is_err());
        drop(first);
        assert!(claim_session_operation("serialized-session").is_ok());
    }

    #[test]
    fn restore_gate_is_held_until_the_scan_finishes() {
        let gate = Mutex::new(SessionRestoreGate::default());

        let restored = restore_once(&gate, || {
            assert!(matches!(gate.try_lock(), Err(TryLockError::WouldBlock)));
            Ok(())
        })
        .unwrap();

        assert!(restored);
        assert!(!restore_once(&gate, || panic!("restore ran twice")).unwrap());
    }

    #[test]
    fn failed_restore_is_retried() {
        let gate = Mutex::new(SessionRestoreGate::default());

        assert!(restore_once(&gate, || Err("scan failed".to_string())).is_err());
        assert!(restore_once(&gate, || Ok(())).unwrap());
    }

    #[test]
    fn missing_session_root_is_a_successful_empty_scan() {
        let directory = tempfile::tempdir().unwrap();

        let records = scan_session_records(&directory.path().join("missing-root")).unwrap();

        assert!(records.is_empty());
    }

    #[test]
    fn unreadable_session_root_does_not_count_as_an_empty_scan() {
        let directory = tempfile::tempdir().unwrap();
        let file = directory.path().join("not-a-directory");
        std::fs::write(&file, "content").unwrap();

        assert!(scan_session_records(&file).is_err());
    }

    #[test]
    fn initial_scan_preserves_a_manifest_without_its_local_copy() {
        let root = tempfile::tempdir().unwrap();
        let session_directory = root.path().join("session-id");
        std::fs::create_dir(&session_directory).unwrap();
        let record = edit_session_record(
            session_directory.join("missing.txt"),
            EditSessionStatus::Editing,
        );
        std::fs::write(
            session_directory.join(SESSION_MANIFEST_FILE),
            serde_json::to_vec(&record).unwrap(),
        )
        .unwrap();

        let records = scan_session_records(root.path()).unwrap();

        assert_eq!(records.len(), 1);
        assert!(session_directory.exists());
    }

    #[test]
    fn initial_scan_restores_a_valid_local_copy() {
        let root = tempfile::tempdir().unwrap();
        let session_directory = root.path().join("session-id");
        std::fs::create_dir(&session_directory).unwrap();
        let local_path = session_directory.join("file.txt");
        std::fs::write(&local_path, "content").unwrap();
        let record = edit_session_record(local_path, EditSessionStatus::Editing);
        std::fs::write(
            session_directory.join(SESSION_MANIFEST_FILE),
            serde_json::to_vec(&record).unwrap(),
        )
        .unwrap();

        let records = scan_session_records(root.path()).unwrap();

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].session_id, "session-id");
    }

    #[tokio::test]
    async fn transiently_missing_local_copy_keeps_the_active_session() {
        let root = tempfile::tempdir().unwrap();
        let session_directory = root.path().join("session-id");
        std::fs::create_dir(&session_directory).unwrap();
        let local_path = session_directory.join("file.txt");
        let mut record = edit_session_record(local_path.clone(), EditSessionStatus::Editing);
        record.session_id = uuid::Uuid::new_v4().to_string();
        let session_id = record.session_id.clone();
        std::fs::write(
            session_directory.join(SESSION_MANIFEST_FILE),
            serde_json::to_vec(&record).unwrap(),
        )
        .unwrap();
        let sessions = Mutex::new(HashMap::from([(session_id, record)]));
        let restored_path = local_path.clone();
        let restore_file = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(10)).await;
            std::fs::write(restored_path, "content").unwrap();
        });

        retire_confirmed_missing_sessions(
            &sessions,
            Some("connection-id"),
            Some("/remote/file.txt"),
            Duration::from_millis(50),
        )
        .await
        .unwrap();
        restore_file.await.unwrap();

        assert_eq!(sessions.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn stably_missing_local_copy_retires_the_active_session() {
        let root = tempfile::tempdir().unwrap();
        let session_directory = root.path().join("session-id");
        std::fs::create_dir(&session_directory).unwrap();
        let mut record = edit_session_record(
            session_directory.join("missing.txt"),
            EditSessionStatus::Editing,
        );
        record.session_id = uuid::Uuid::new_v4().to_string();
        let session_id = record.session_id.clone();
        std::fs::write(
            session_directory.join(SESSION_MANIFEST_FILE),
            serde_json::to_vec(&record).unwrap(),
        )
        .unwrap();
        let sessions = Mutex::new(HashMap::from([(session_id, record)]));

        retire_confirmed_missing_sessions(
            &sessions,
            Some("connection-id"),
            Some("/remote/file.txt"),
            Duration::from_millis(1),
        )
        .await
        .unwrap();

        assert!(sessions.lock().unwrap().is_empty());
        let terminal: EditSessionRecord = serde_json::from_slice(
            &std::fs::read(session_directory.join(SESSION_MANIFEST_FILE)).unwrap(),
        )
        .unwrap();
        assert_eq!(terminal.status, EditSessionStatus::Abandoned);
        assert!(session_directory.exists());
    }

    #[tokio::test]
    async fn stale_missing_candidate_does_not_overwrite_a_completed_manifest() {
        let root = tempfile::tempdir().unwrap();
        let session_directory = root.path().join("session-id");
        std::fs::create_dir(&session_directory).unwrap();
        let mut candidate = edit_session_record(
            session_directory.join("missing.txt"),
            EditSessionStatus::Editing,
        );
        candidate.session_id = uuid::Uuid::new_v4().to_string();
        let mut completed = candidate.clone();
        completed.status = EditSessionStatus::Completed;
        std::fs::write(
            session_directory.join(SESSION_MANIFEST_FILE),
            serde_json::to_vec(&completed).unwrap(),
        )
        .unwrap();
        let sessions = Mutex::new(HashMap::new());

        retire_confirmed_missing_candidates(&sessions, vec![candidate], Duration::from_millis(1))
            .await
            .unwrap();

        let persisted: EditSessionRecord = serde_json::from_slice(
            &std::fs::read(session_directory.join(SESSION_MANIFEST_FILE)).unwrap(),
        )
        .unwrap();
        assert_eq!(persisted.status, EditSessionStatus::Completed);
    }

    #[tokio::test]
    async fn finish_uses_an_immutable_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("editing.txt");
        std::fs::write(&source, "stable content").unwrap();

        let snapshot = create_stable_snapshot(source.clone()).await.unwrap();

        assert_ne!(snapshot.path, source);
        assert_eq!(snapshot.digest, file_digest(&source).unwrap());
        assert_eq!(std::fs::read(&snapshot.path).unwrap(), b"stable content");
    }

    #[test]
    fn failed_session_setup_removes_the_provisional_directory() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("provisional-session");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("sensitive.txt"), "secret").unwrap();

        {
            let _guard = ProvisionalSessionDirectory::new(directory.clone());
        }

        assert!(!directory.exists());
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
                editor_candidate_exists(&editor.path),
                "{}",
                editor.path.display()
            );
        }
    }

    #[test]
    fn discovered_application_paths_exist() {
        for application in discover_local_applications() {
            assert!(
                editor_candidate_exists(&application.path),
                "{}",
                application.path.display()
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
