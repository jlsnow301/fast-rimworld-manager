use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SteamModPreview {
    pub(crate) published_file_id: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) preview_url: Option<String>,
    pub(crate) time_updated: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OutdatedWorkshopMod {
    pub(crate) name: String,
    pub(crate) package_id: String,
    pub(crate) published_file_id: String,
    pub(crate) installed_time_updated: u64,
    pub(crate) steam_time_updated: u64,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkshopUpdateCheckResult {
    pub(crate) checked_count: usize,
    pub(crate) skipped_count: usize,
    pub(crate) outdated_mods: Vec<OutdatedWorkshopMod>,
}
