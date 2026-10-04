use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InstalledMod {
    pub(crate) name: String,
    pub(crate) author: Option<String>,
    pub(crate) mod_version: Option<String>,
    pub(crate) package_id: String,
    pub(crate) description: String,
    pub(crate) published_file_id: Option<String>,
    #[serde(skip)]
    pub(crate) load_top: bool,
    #[serde(skip)]
    pub(crate) load_bottom: bool,
    pub(crate) load_after: Vec<String>,
    pub(crate) load_before: Vec<String>,
    pub(crate) incompatible_with: Vec<String>,
    pub(crate) supported_versions: Vec<String>,
    pub(crate) version_warning_silenced: bool,
    pub(crate) dependencies: Vec<ModDependency>,
    pub(crate) path: String,
    pub(crate) source: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModDependency {
    pub(crate) package_id: String,
    pub(crate) name: String,
    pub(crate) alternative_package_ids: Vec<String>,
}
