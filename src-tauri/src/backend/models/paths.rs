use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PathSettings {
    pub(crate) game_path: String,
    pub(crate) config_path: String,
    pub(crate) local_mods_path: String,
    pub(crate) workshop_path: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DetectedPaths {
    pub(crate) game_path: Option<String>,
    pub(crate) config_path: Option<String>,
    pub(crate) local_mods_path: Option<String>,
    pub(crate) workshop_path: Option<String>,
}
