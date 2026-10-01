use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DatabaseKind {
    CommunityRules,
    SteamWorkshop,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseDownloadResult {
    pub(crate) database: DatabaseKind,
    pub(crate) bytes_downloaded: u64,
}
