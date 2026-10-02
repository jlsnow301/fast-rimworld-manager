use std::collections::{HashMap, HashSet};

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
    if graph_has_cycle(&edges) {
        return Err("Active mods contain circular load-order rules.".to_string());
    }

    let mut dependencies = vec![HashSet::new(); active_mods.len()];
    for (dependency_index, dependents) in edges.iter().enumerate() {
        for dependent_index in dependents {
            dependencies[*dependent_index].insert(dependency_index);
        }
    }

    let mut tier_zero_roots = HashSet::new();
    let mut tier_one_roots = HashSet::new();
    let mut tier_three_roots = HashSet::new();
    for (index, package_id) in active_mods.iter().enumerate() {
        let normalized_id = normalize_package_id(package_id);
        if TIER_ZERO_PACKAGE_IDS.contains(&normalized_id.as_str()) {
            tier_zero_roots.insert(index);
        }
        if TIER_ONE_PACKAGE_IDS.contains(&normalized_id.as_str()) {
            tier_one_roots.insert(index);
        }
        if let Some(mod_entry) = installed_by_id.get(&normalized_id) {
            if mod_entry.load_top && !TIER_ZERO_PACKAGE_IDS.contains(&normalized_id.as_str()) {
                tier_one_roots.insert(index);
            }
            if mod_entry.load_bottom {
                tier_three_roots.insert(index);
            }
        }
    }

    let tier_zero = expand_graph(tier_zero_roots, &dependencies);
    let tier_one = expand_graph(tier_one_roots, &dependencies);
    let tier_three = expand_graph(tier_three_roots, &edges);
    let tier_two = (0..active_mods.len())
        .filter(|index| {
            !tier_zero.contains(index) && !tier_one.contains(index) && !tier_three.contains(index)
        })
        .collect();

    let sort_keys: Vec<(String, String)> = active_mods
        .iter()
        .map(|package_id| {
            let normalized_id = normalize_package_id(package_id);
            let name = installed_by_id
                .get(&normalized_id)
                .map_or(package_id.as_str(), |mod_entry| mod_entry.name.as_str());
            (name.to_lowercase(), normalized_id)
        })
        .collect();

    let mut sorted_indices = Vec::with_capacity(active_mods.len());
    let mut sorted_set = HashSet::with_capacity(active_mods.len());
    for tier in [tier_zero, tier_one, tier_two, tier_three] {
        for index in sort_tier(&tier, &edges, &sort_keys) {
            if sorted_set.insert(index) {
                sorted_indices.push(index);
            }
        }
    }

    Ok(sorted_indices
        .into_iter()
        .map(|index| active_mods[index].clone())
        .collect())
}

const TIER_ZERO_PACKAGE_IDS: &[&str] = &[
    "brrainz.harmony",
    "brrainz.visualexceptions",
    "ludeon.rimworld",
    "ludeon.rimworld.anomaly",
    "ludeon.rimworld.biotech",
    "ludeon.rimworld.ideology",
    "ludeon.rimworld.odyssey",
    "ludeon.rimworld.royalty",
    "zetrith.prepatcher",
];

const TIER_ONE_PACKAGE_IDS: &[&str] = &[
    "adaptive.storage.framework",
    "aoba.exosuit.framework",
    "aoba.framework",
    "ebsg.framework",
    "imranfish.xmlextensions",
    "ohno.asf.ab.local",
    "oskarpotocki.vanillafactionsexpanded.core",
    "owlchemist.cherrypicker",
    "redmattis.betterprerequisites",
    "smashphil.vehicleframework",
    "thesepeople.ritualattachableoutcomes",
    "unlimitedhugs.hugslib",
    "vanillaexpanded.backgrounds",
];

fn graph_has_cycle(edges: &[HashSet<usize>]) -> bool {
    let mut indegrees = vec![0; edges.len()];
    for dependents in edges {
        for dependent_index in dependents {
            indegrees[*dependent_index] += 1;
        }
    }

    let mut ready: Vec<usize> = indegrees
        .iter()
        .enumerate()
        .filter_map(|(index, indegree)| (*indegree == 0).then_some(index))
        .collect();
    let mut sorted_count = 0;
    while let Some(index) = ready.pop() {
        sorted_count += 1;
        for dependent_index in &edges[index] {
            indegrees[*dependent_index] -= 1;
            if indegrees[*dependent_index] == 0 {
                ready.push(*dependent_index);
            }
        }
    }

    sorted_count != edges.len()
}

fn expand_graph(roots: HashSet<usize>, graph: &[HashSet<usize>]) -> HashSet<usize> {
    let mut expanded = roots;
    let mut pending: Vec<usize> = expanded.iter().copied().collect();
    while let Some(index) = pending.pop() {
        for adjacent_index in &graph[index] {
            if expanded.insert(*adjacent_index) {
                pending.push(*adjacent_index);
            }
        }
    }
    expanded
}

fn sort_tier(
    tier: &HashSet<usize>,
    edges: &[HashSet<usize>],
    sort_keys: &[(String, String)],
) -> Vec<usize> {
    let mut indegrees = vec![0; edges.len()];
    for index in tier {
        for dependent_index in &edges[*index] {
            if tier.contains(dependent_index) {
                indegrees[*dependent_index] += 1;
            }
        }
    }

    let mut ready: Vec<usize> = tier
        .iter()
        .copied()
        .filter(|index| indegrees[*index] == 0)
        .collect();
    let mut sorted = Vec::with_capacity(tier.len());
    let mut next_level = Vec::new();
    while !ready.is_empty() {
        ready.sort_unstable_by(|left, right| {
            sort_keys[*left]
                .cmp(&sort_keys[*right])
                .then_with(|| left.cmp(right))
        });
        for index in ready.drain(..) {
            sorted.push(index);
            for dependent_index in &edges[index] {
                if tier.contains(dependent_index) {
                    indegrees[*dependent_index] -= 1;
                    if indegrees[*dependent_index] == 0 {
                        next_level.push(*dependent_index);
                    }
                }
            }
        }
        std::mem::swap(&mut ready, &mut next_level);
    }

    sorted
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
            load_top: false,
            load_bottom: false,
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
    fn sorts_dependencies_before_dependents_and_keeps_the_known_core_in_tier_zero() {
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
                "Ludeon.RimWorld",
                "Author.Framework",
                "Author.Unrelated",
                "Author.Consumer"
            ]
        );
    }

    #[test]
    fn sorts_unconstrained_mods_alphabetically_by_name() {
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

        assert_eq!(sorted, vec!["Author.Alpha", "Author.Middle", "Author.Zulu"]);
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
    #[test]
    fn sorts_known_categories_and_top_bottom_rules_into_ordered_tiers() {
        let active = vec![
            "Author.Regular".to_string(),
            "Author.Bottom.Child".to_string(),
            "Author.Bottom".to_string(),
            "Author.Top".to_string(),
            "unlimitedhugs.hugslib".to_string(),
            "ludeon.rimworld.royalty".to_string(),
            "ludeon.rimworld.ideology".to_string(),
            "ludeon.rimworld.biotech".to_string(),
            "ludeon.rimworld.anomaly".to_string(),
            "ludeon.rimworld.odyssey".to_string(),
            "brrainz.harmony".to_string(),
            "zetrith.prepatcher".to_string(),
            "ludeon.rimworld".to_string(),
        ];
        let mut top = installed_mod("Author.Top", "Top", &[], &[]);
        top.load_top = true;
        let mut bottom = installed_mod("Author.Bottom", "Bottom", &[], &[]);
        bottom.load_bottom = true;
        let installed = vec![
            installed_mod("Author.Regular", "Regular", &[], &[]),
            installed_mod(
                "Author.Bottom.Child",
                "Bottom Child",
                &["Author.Bottom"],
                &[],
            ),
            bottom,
            top,
            installed_mod("unlimitedhugs.hugslib", "Framework", &[], &[]),
            installed_mod("ludeon.rimworld.ideology", "RimWorld Ideology", &[], &[]),
            installed_mod("ludeon.rimworld.biotech", "RimWorld Biotech", &[], &[]),
            installed_mod("ludeon.rimworld.anomaly", "RimWorld Anomaly", &[], &[]),
            installed_mod("ludeon.rimworld.odyssey", "RimWorld Odyssey", &[], &[]),
            installed_mod("ludeon.rimworld.royalty", "RimWorld Royalty", &[], &[]),
            installed_mod("brrainz.harmony", "Harmony", &[], &[]),
            installed_mod("zetrith.prepatcher", "Prepatcher", &[], &[]),
            installed_mod("ludeon.rimworld", "Core", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(
            sorted,
            vec![
                "ludeon.rimworld",
                "brrainz.harmony",
                "zetrith.prepatcher",
                "ludeon.rimworld.anomaly",
                "ludeon.rimworld.biotech",
                "ludeon.rimworld.ideology",
                "ludeon.rimworld.odyssey",
                "ludeon.rimworld.royalty",
                "unlimitedhugs.hugslib",
                "Author.Top",
                "Author.Regular",
                "Author.Bottom",
                "Author.Bottom.Child"
            ]
        );
    }

    #[test]
    fn expands_known_tier_zero_dependencies_recursively() {
        let active = vec![
            "Ludeon.RimWorld".to_string(),
            "Author.Dependency".to_string(),
            "Author.DeepDependency".to_string(),
        ];
        let core = installed_mod("Ludeon.RimWorld", "Core", &["Author.Dependency"], &[]);
        let dependency_mod = installed_mod(
            "Author.Dependency",
            "Dependency",
            &["Author.DeepDependency"],
            &[],
        );
        let installed = vec![
            core,
            dependency_mod,
            installed_mod("Author.DeepDependency", "Deep Dependency", &[], &[]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(
            sorted,
            vec![
                "Author.DeepDependency",
                "Author.Dependency",
                "Ludeon.RimWorld"
            ]
        );
    }

    #[test]
    fn expands_top_dependencies_and_bottom_reverse_dependencies_recursively() {
        let active = vec![
            "Author.Top".to_string(),
            "Author.TopDependency".to_string(),
            "Author.TopDependencyDependency".to_string(),
            "Author.Regular".to_string(),
            "Author.Bottom".to_string(),
            "Author.BottomDependent".to_string(),
            "Author.BottomReverseDependent".to_string(),
        ];
        let mut top = installed_mod("Author.Top", "Top", &[], &[]);
        top.load_top = true;
        top.dependencies = vec![dependency("Author.TopDependency", &[])];
        let mut top_dependency = installed_mod("Author.TopDependency", "Top Dependency", &[], &[]);
        top_dependency.dependencies = vec![dependency("Author.TopDependencyDependency", &[])];
        let mut bottom = installed_mod("Author.Bottom", "Bottom", &[], &[]);
        bottom.load_bottom = true;
        let installed = vec![
            top,
            top_dependency,
            installed_mod(
                "Author.TopDependencyDependency",
                "Top Dependency Dependency",
                &[],
                &[],
            ),
            installed_mod("Author.Regular", "Regular", &[], &[]),
            bottom,
            installed_mod(
                "Author.BottomDependent",
                "Bottom Dependent",
                &["Author.Bottom"],
                &[],
            ),
            installed_mod(
                "Author.BottomReverseDependent",
                "Bottom Reverse Dependent",
                &["Author.BottomDependent"],
                &[],
            ),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(
            sorted,
            vec![
                "Author.TopDependencyDependency",
                "Author.TopDependency",
                "Author.Top",
                "Author.Regular",
                "Author.Bottom",
                "Author.BottomDependent",
                "Author.BottomReverseDependent"
            ]
        );
    }

    #[test]
    fn sorts_each_topological_level_alphabetically() {
        let active = vec![
            "Author.Dependent".to_string(),
            "Author.Free".to_string(),
            "Author.Root".to_string(),
        ];
        let installed = vec![
            installed_mod("Author.Dependent", "Aardvark", &[], &[]),
            installed_mod("Author.Free", "Beta", &[], &[]),
            installed_mod("Author.Root", "Zulu", &[], &["Author.Dependent"]),
        ];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(
            sorted,
            vec!["Author.Free", "Author.Root", "Author.Dependent"]
        );
    }

    #[test]
    fn retains_active_ids_without_installed_metadata() {
        let active = vec!["missing.package".to_string(), "Author.A".to_string()];
        let installed = vec![installed_mod("Author.A", "A", &[], &[])];

        let sorted = sort_package_ids(&active, &installed).expect("mods should sort");

        assert_eq!(sorted, vec!["Author.A", "missing.package"]);
    }

    #[test]
    fn reports_cycles_that_cross_category_tiers() {
        let active = vec!["Ludeon.RimWorld".to_string(), "Author.Mod".to_string()];
        let installed = vec![
            installed_mod("Ludeon.RimWorld", "Core", &["Author.Mod"], &[]),
            installed_mod("Author.Mod", "Mod", &["Ludeon.RimWorld"], &[]),
        ];

        let error = sort_package_ids(&active, &installed).expect_err("cycle must fail");

        assert_eq!(error, "Active mods contain circular load-order rules.");
    }
}
