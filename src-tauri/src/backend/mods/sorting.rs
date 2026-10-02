use std::collections::{BTreeSet, HashMap, HashSet};

use tauri::AppHandle;

use super::{inventory::collect_installed_mods, model::InstalledMod};
use crate::backend::paths::settings::load_path_settings_for_app;

const KNOWN_TIER_ZERO_MODS: &[&str] = &[
    "zetrith.prepatcher",
    "brrainz.harmony",
    "brrainz.visualexceptions",
    "ludeon.rimworld",
    "ludeon.rimworld.royalty",
    "ludeon.rimworld.ideology",
    "ludeon.rimworld.biotech",
    "ludeon.rimworld.anomaly",
    "ludeon.rimworld.odyssey",
];

const KNOWN_TIER_ONE_MODS: &[&str] = &[
    "adaptive.storage.framework",
    "aoba.framework",
    "aoba.exosuit.framework",
    "ebsg.framework",
    "imranfish.xmlextensions",
    "thesepeople.ritualattachableoutcomes",
    "ohno.asf.ab.local",
    "oskarpotocki.vanillafactionsexpanded.core",
    "owlchemist.cherrypicker",
    "redmattis.betterprerequisites",
    "smashphil.vehicleframework",
    "unlimitedhugs.hugslib",
    "vanillaexpanded.backgrounds",
];

pub(crate) fn sort_active_mods(
    app: AppHandle,
    active_mods: Vec<String>,
) -> Result<Vec<String>, String> {
    let settings = load_path_settings_for_app(&app)?;
    let installed_mods = collect_installed_mods(&settings)?;
    sort_package_ids(&active_mods, &installed_mods)
}

fn sort_package_ids(
    active_mods: &[String],
    installed_mods: &[InstalledMod],
) -> Result<Vec<String>, String> {
    let mut installed_by_id: HashMap<String, &InstalledMod> = HashMap::new();
    for mod_entry in installed_mods {
        installed_by_id
            .entry(normalize_package_id(&mod_entry.package_id))
            .or_insert(mod_entry);
    }

    let mut active_by_id: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, package_id) in active_mods.iter().enumerate() {
        active_by_id
            .entry(normalize_package_id(package_id))
            .or_default()
            .push(index);
    }

    let mut edges = vec![HashSet::new(); active_mods.len()];
    for (index, package_id) in active_mods.iter().enumerate() {
        let Some(mod_entry) = installed_by_id.get(&normalize_package_id(package_id)) else {
            continue;
        };

        for dependency_id in &mod_entry.load_after {
            if let Some(dependency_indices) = active_by_id.get(&normalize_package_id(dependency_id))
            {
                for dependency_index in dependency_indices {
                    if *dependency_index != index {
                        edges[*dependency_index].insert(index);
                    }
                }
            }
        }

        for target_id in &mod_entry.load_before {
            if let Some(target_indices) = active_by_id.get(&normalize_package_id(target_id)) {
                for target_index in target_indices {
                    if *target_index != index {
                        edges[index].insert(*target_index);
                    }
                }
            }
        }
    }

    let mut indegrees = vec![0; active_mods.len()];
    for dependents in &edges {
        for dependent in dependents {
            indegrees[*dependent] += 1;
        }
    }

    let mut ready = BTreeSet::new();
    for (index, indegree) in indegrees.iter().enumerate() {
        if *indegree == 0 {
            ready.insert(sort_key(index, active_mods, &installed_by_id));
        }
    }

    let mut sorted_indices = Vec::with_capacity(active_mods.len());
    while let Some(next) = ready.pop_first() {
        let index = next.2;
        sorted_indices.push(index);
        for dependent in &edges[index] {
            indegrees[*dependent] -= 1;
            if indegrees[*dependent] == 0 {
                ready.insert(sort_key(*dependent, active_mods, &installed_by_id));
            }
        }
    }

    if sorted_indices.len() != active_mods.len() {
        return Err("Active mods contain circular load-order rules.".to_string());
    }

    Ok(sorted_indices
        .into_iter()
        .map(|index| active_mods[index].clone())
        .collect())
}

fn sort_key(
    index: usize,
    active_mods: &[String],
    installed_by_id: &HashMap<String, &InstalledMod>,
) -> (u8, String, usize) {
    let package_id = &active_mods[index];
    let normalized_id = normalize_package_id(package_id);
    let rank = if KNOWN_TIER_ZERO_MODS.contains(&normalized_id.as_str()) {
        0
    } else if KNOWN_TIER_ONE_MODS.contains(&normalized_id.as_str()) {
        1
    } else {
        2
    };
    let name = installed_by_id
        .get(&normalized_id)
        .map(|mod_entry| mod_entry.name.to_lowercase())
        .unwrap_or_else(|| package_id.to_lowercase());
    (rank, name, index)
}

fn normalize_package_id(package_id: &str) -> String {
    package_id
        .trim()
        .to_lowercase()
        .trim_end_matches("_steam")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn installed_mod(
        package_id: &str,
        name: &str,
        load_after: &[&str],
        load_before: &[&str],
    ) -> InstalledMod {
        InstalledMod {
            name: name.to_string(),
            author: None,
            package_id: package_id.to_string(),
            description: String::new(),
            published_file_id: None,
            load_after: load_after.iter().map(|id| id.to_string()).collect(),
            load_before: load_before.iter().map(|id| id.to_string()).collect(),
            incompatible_with: Vec::new(),
            supported_versions: Vec::new(),
            version_warning_silenced: false,
            dependencies: Vec::new(),
            path: String::new(),
            source: "local".to_string(),
        }
    }

    #[test]
    fn sorts_dependencies_before_dependents_and_keeps_inactive_out() {
        let active = vec![
            "Author.Consumer".to_string(),
            "Ludeon.RimWorld".to_string(),
            "Author.Framework".to_string(),
        ];
        let installed = vec![
            installed_mod("Author.Consumer", "Consumer", &["Author.Framework"], &[]),
            installed_mod("Ludeon.RimWorld", "Core", &[], &[]),
            installed_mod("Author.Framework", "Framework", &["Ludeon.RimWorld"], &[]),
            installed_mod("Author.Inactive", "Inactive", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(
            sorted,
            vec!["Ludeon.RimWorld", "Author.Framework", "Author.Consumer"]
        );
    }

    #[test]
    fn obeys_load_before_and_steam_suffixed_active_ids() {
        let active = vec![
            "Author.Other".to_string(),
            "Author.Framework_steam".to_string(),
        ];
        let installed = vec![
            installed_mod("Author.Other", "Other", &[], &[]),
            installed_mod("Author.Framework", "Framework", &[], &["Author.Other"]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(sorted, vec!["Author.Framework_steam", "Author.Other"]);
    }

    #[test]
    fn reports_circular_load_order_rules() {
        let active = vec!["Author.First".to_string(), "Author.Second".to_string()];
        let installed = vec![
            installed_mod("Author.First", "First", &["Author.Second"], &[]),
            installed_mod("Author.Second", "Second", &["Author.First"], &[]),
        ];

        let error = sort_package_ids(&active, &installed).expect_err("cycle must fail");

        assert_eq!(error, "Active mods contain circular load-order rules.");
    }
}
