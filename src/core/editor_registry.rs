use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegisteredEditor {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
}

#[derive(Default)]
pub struct EditorRegistry {
    editors: HashMap<String, RegisteredEditor>,
}

impl EditorRegistry {
    pub fn register(&mut self, name: impl Into<String>, path: PathBuf) -> RegisteredEditor {
        let id = editor_id_for_path(&path);
        let editor = RegisteredEditor {
            id: id.clone(),
            name: name.into(),
            path,
        };
        self.editors.insert(id, editor.clone());
        editor
    }

    pub fn resolve(&self, id: &str) -> Option<&Path> {
        self.editors.get(id).map(|editor| editor.path.as_path())
    }

    pub fn get(&self, id: &str) -> Option<&RegisteredEditor> {
        self.editors.get(id)
    }

    pub fn remove(&mut self, id: &str) -> bool {
        self.editors.remove(id).is_some()
    }

    pub fn list(&self) -> Vec<&RegisteredEditor> {
        let mut editors: Vec<_> = self.editors.values().collect();
        editors.sort_by(|left, right| left.name.cmp(&right.name));
        editors
    }
}

pub fn editor_id_for_path(path: &Path) -> String {
    let mut normalized = path.to_string_lossy().replace('\\', "/");
    if cfg!(any(target_os = "windows", target_os = "macos")) {
        normalized.make_ascii_lowercase();
    }
    let digest = Sha256::digest(normalized.as_bytes());
    format!("editor-{:x}", digest)[..23].to_string()
}

#[cfg(test)]
mod tests {
    use super::EditorRegistry;
    use std::path::{Path, PathBuf};

    #[test]
    fn unknown_editor_id_cannot_resolve_to_an_executable() {
        let registry = EditorRegistry::default();

        assert_eq!(registry.resolve("editor-untrusted"), None);
    }

    #[test]
    fn registered_editor_resolves_only_by_opaque_id() {
        let mut registry = EditorRegistry::default();
        let editor = registry.register("Test Editor", PathBuf::from("/Applications/Test.app"));

        assert!(editor.id.starts_with("editor-"));
        assert_eq!(
            registry.resolve(&editor.id),
            Some(Path::new("/Applications/Test.app"))
        );
        assert_eq!(registry.resolve("/Applications/Test.app"), None);
    }

    #[test]
    fn registering_the_same_path_reuses_the_same_editor_id() {
        let mut registry = EditorRegistry::default();

        let first = registry.register("Test Editor", PathBuf::from("/Applications/Test.app"));
        let second = registry.register("Renamed", PathBuf::from("/Applications/Test.app"));

        assert_eq!(first.id, second.id);
        assert_eq!(registry.list().len(), 1);
    }

    #[test]
    fn removed_editor_id_no_longer_resolves() {
        let mut registry = EditorRegistry::default();
        let editor = registry.register("Test Editor", PathBuf::from("/Applications/Test.app"));

        assert!(registry.remove(&editor.id));
        assert_eq!(registry.resolve(&editor.id), None);
    }
}
