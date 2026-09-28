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
