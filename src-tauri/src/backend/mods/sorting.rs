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

    let sorted_indices = sort_tiers(
        [tier_zero, tier_one, tier_two, tier_three],
        &edges,
        &sort_keys,
    )?;

    Ok(sorted_indices
        .into_iter()
        .map(|index| active_mods[index].clone())
        .collect())
}

fn sort_tiers(
    tiers: [HashSet<usize>; 4],
    edges: &[HashSet<usize>],
    sort_keys: &[(String, String)],
) -> Result<Vec<usize>, String> {
    let mut sorted_indices = Vec::with_capacity(edges.len());
    let mut sorted_set = HashSet::with_capacity(edges.len());
    for tier in tiers {
        let tier_indices = sort_tier(&tier, edges, sort_keys);
        if tier_indices.len() != tier.len() {
            return Err("Active mods contain circular load-order rules.".to_string());
        }
        for index in tier_indices {
            if sorted_set.insert(index) {
                sorted_indices.push(index);
            }
        }
    }
    Ok(sorted_indices)
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
mod tests;
