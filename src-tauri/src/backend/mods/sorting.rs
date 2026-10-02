use std::collections::{BTreeSet, HashMap, HashSet};

use tauri::AppHandle;

use super::{inventory::collect_installed_mods, model::InstalledMod};
use crate::backend::paths::settings::load_path_settings_for_app;

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
                    edges[*dependency_index].insert(index);
                }
            }
        }

        for target_id in &mod_entry.load_before {
            if let Some(target_indices) = active_by_id.get(&normalize_package_id(target_id)) {
                for target_index in target_indices {
                    edges[index].insert(*target_index);
                }
            }
        }
    }

    let mut inferred_edges = Vec::new();
    for (index, package_id) in active_mods.iter().enumerate() {
        let Some(mod_entry) = installed_by_id.get(&normalize_package_id(package_id)) else {
            continue;
        };

        for dependency in &mod_entry.dependencies {
            let dependency_id = normalize_package_id(&dependency.package_id);
            let resolved_dependency_id = if installed_by_id.contains_key(&dependency_id) {
                Some(dependency_id)
            } else {
                dependency
                    .alternative_package_ids
                    .iter()
                    .map(|alternative_id| normalize_package_id(alternative_id))
                    .find(|alternative_id| installed_by_id.contains_key(alternative_id))
            };
            let Some(resolved_dependency_id) = resolved_dependency_id else {
                continue;
            };
            let Some(dependency_indices) = active_by_id.get(&resolved_dependency_id) else {
                continue;
            };

            for dependency_index in dependency_indices {
                if !edges[index].contains(dependency_index) {
                    inferred_edges.push((*dependency_index, index));
                }
            }
        }
    }
    for (dependency_index, dependent_index) in inferred_edges {
        edges[dependency_index].insert(dependent_index);
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
            ready.insert(index);
        }
    }

    let mut sorted_indices = Vec::with_capacity(active_mods.len());
    while let Some(index) = ready.pop_first() {
        sorted_indices.push(index);
        for dependent in &edges[index] {
            indegrees[*dependent] -= 1;
            if indegrees[*dependent] == 0 {
                ready.insert(*dependent);
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

fn normalize_package_id(package_id: &str) -> String {
    package_id
        .trim()
        .to_lowercase()
        .trim_end_matches("_steam")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::super::model::ModDependency;
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

    fn dependency(package_id: &str, alternative_package_ids: &[&str]) -> ModDependency {
        ModDependency {
            package_id: package_id.to_string(),
            name: package_id.to_string(),
            alternative_package_ids: alternative_package_ids
                .iter()
                .map(|id| id.to_string())
                .collect(),
        }
    }

    #[test]
    fn sorts_dependencies_before_dependents_and_keeps_unrelated_order_stable() {
        let active = vec![
            "Author.Consumer".to_string(),
            "Author.Unrelated".to_string(),
            "Author.Framework".to_string(),
            "Ludeon.RimWorld".to_string(),
        ];
        let mut consumer = installed_mod("Author.Consumer", "Consumer", &[], &[]);
        consumer.dependencies = vec![dependency("Author.Framework", &[])];
        let mut framework = installed_mod("Author.Framework", "Framework", &[], &[]);
        framework.dependencies = vec![dependency("Ludeon.RimWorld", &[])];
        let installed = vec![
            consumer,
            installed_mod("Author.Unrelated", "Unrelated", &[], &[]),
            framework,
            installed_mod("Ludeon.RimWorld", "Core", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(
            sorted,
            vec![
                "Author.Unrelated",
                "Ludeon.RimWorld",
                "Author.Framework",
                "Author.Consumer"
            ]
        );
    }

    #[test]
    fn keeps_unconstrained_mods_in_input_order() {
        let active = vec![
            "Author.Zulu".to_string(),
            "Author.Alpha".to_string(),
            "Author.Middle".to_string(),
        ];
        let installed = vec![
            installed_mod("Author.Zulu", "Zulu", &[], &[]),
            installed_mod("Author.Alpha", "Alpha", &[], &[]),
            installed_mod("Author.Middle", "Middle", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(sorted, active);
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
    fn uses_installed_alternative_ids_for_dependencies() {
        let active = vec![
            "Author.Consumer".to_string(),
            "Author.Framework".to_string(),
        ];
        let mut consumer = installed_mod("Author.Consumer", "Consumer", &[], &[]);
        consumer.dependencies = vec![dependency("Unavailable.Framework", &["Author.Framework"])];
        let installed = vec![
            consumer,
            installed_mod("Author.Framework", "Framework", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(sorted, vec!["Author.Framework", "Author.Consumer"]);
    }

    #[test]
    fn ignores_missing_dependencies_without_dropping_mods() {
        let active = vec!["Author.Consumer".to_string(), "Author.Other".to_string()];
        let mut consumer = installed_mod("Author.Consumer", "Consumer", &[], &[]);
        consumer.dependencies = vec![dependency("Author.Missing", &[])];
        let installed = vec![consumer, installed_mod("Author.Other", "Other", &[], &[])];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(sorted, active);
    }

    #[test]
    fn explicit_load_order_wins_over_conflicting_dependency_metadata() {
        let active = vec![
            "Author.Consumer".to_string(),
            "Author.Framework".to_string(),
        ];
        let mut consumer = installed_mod("Author.Consumer", "Consumer", &[], &["Author.Framework"]);
        consumer.dependencies = vec![dependency("Author.Framework", &[])];
        let installed = vec![
            consumer,
            installed_mod("Author.Framework", "Framework", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(sorted, vec!["Author.Consumer", "Author.Framework"]);
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

    #[test]
    fn reports_circular_dependency_metadata() {
        let active = vec!["Author.First".to_string(), "Author.Second".to_string()];
        let mut first = installed_mod("Author.First", "First", &[], &[]);
        first.dependencies = vec![dependency("Author.Second", &[])];
        let mut second = installed_mod("Author.Second", "Second", &[], &[]);
        second.dependencies = vec![dependency("Author.First", &[])];
        let installed = vec![first, second];

        let error = sort_package_ids(&active, &installed).expect_err("cycle must fail");

        assert_eq!(error, "Active mods contain circular load-order rules.");
    }
}
