use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DatabaseKind {
    CommunityRules,
    SteamWorkshop,
    NoVersionWarning,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseDownloadResult {
    pub(crate) database: DatabaseKind,
    pub(crate) bytes_downloaded: u64,
    pub(crate) last_modified: u64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseFileStatus {
    pub(crate) database: DatabaseKind,
    pub(crate) last_modified: Option<u64>,
}
