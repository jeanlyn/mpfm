use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFingerprint {
    pub etag: Option<String>,
    pub version: Option<String>,
    pub modified: Option<String>,
    pub size: u64,
}

impl RemoteFingerprint {
    pub fn has_strong_identity(&self) -> bool {
        self.version.is_some() || self.etag.is_some()
    }

    pub fn matches(&self, other: &Self) -> bool {
        if let (Some(left), Some(right)) = (&self.version, &other.version) {
            return left == right;
        }
        if let (Some(left), Some(right)) = (&self.etag, &other.etag) {
            return left == right;
        }
        self.modified == other.modified && self.size == other.size
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FinishDecision {
    Unchanged,
    ReadyToUpload,
    Conflict,
}

pub fn decide_finish(
    baseline_digest: &[u8],
    current_digest: &[u8],
    baseline_remote: &RemoteFingerprint,
    current_remote: &RemoteFingerprint,
) -> FinishDecision {
    if baseline_digest == current_digest {
        FinishDecision::Unchanged
    } else if baseline_remote.matches(current_remote) {
        FinishDecision::ReadyToUpload
    } else {
        FinishDecision::Conflict
    }
}

#[cfg(test)]
mod tests {
    use super::{decide_finish, FinishDecision, RemoteFingerprint};

    fn fingerprint(etag: &str, size: u64) -> RemoteFingerprint {
        RemoteFingerprint {
            etag: Some(etag.to_string()),
            version: None,
            modified: Some("2026-08-04T00:00:00Z".to_string()),
            size,
        }
    }

    #[test]
    fn unchanged_local_content_completes_without_upload() {
        let baseline = fingerprint("v1", 4);

        assert_eq!(
            decide_finish(b"same", b"same", &baseline, &baseline),
            FinishDecision::Unchanged
        );
    }

    #[test]
    fn changed_local_content_is_ready_when_remote_version_matches() {
        let baseline = fingerprint("v1", 4);

        assert_eq!(
            decide_finish(b"old", b"new", &baseline, &baseline),
            FinishDecision::ReadyToUpload
        );
    }

    #[test]
    fn changed_remote_content_requires_conflict_resolution() {
        let baseline = fingerprint("v1", 4);
        let current = fingerprint("v2", 8);

        assert_eq!(
            decide_finish(b"old", b"new", &baseline, &current),
            FinishDecision::Conflict
        );
    }

    #[test]
    fn metadata_fallback_detects_remote_changes_without_etag() {
        let baseline = RemoteFingerprint {
            etag: None,
            version: None,
            modified: Some("2026-08-04T00:00:00Z".to_string()),
            size: 4,
        };
        let current = RemoteFingerprint {
            modified: Some("2026-08-04T00:00:01Z".to_string()),
            ..baseline.clone()
        };

        assert_eq!(
            decide_finish(b"old", b"new", &baseline, &current),
            FinishDecision::Conflict
        );
    }
}
