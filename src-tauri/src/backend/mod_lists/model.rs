use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportedModListFile {
    pub(crate) file_name: String,
    pub(crate) contents: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveModListArgs {
    pub(crate) version: String,
    pub(crate) active_mods: Vec<String>,
    pub(crate) known_expansions: Vec<String>,
}
