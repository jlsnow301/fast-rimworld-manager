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
        mod_version: None,
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
fn sorts_cross_tier_cycles_in_tier_order() {
    let edges = vec![HashSet::from([1]), HashSet::from([0])];
    let tiers = [
        HashSet::from([0]),
        HashSet::new(),
        HashSet::from([1]),
        HashSet::new(),
    ];
    let sort_keys = vec![
        ("Zulu".to_string(), "tier-zero".to_string()),
        ("Alpha".to_string(), "tier-two".to_string()),
    ];

    let sorted = sort_tiers(tiers, &edges, &sort_keys).expect("tiers should sort");

    assert_eq!(sorted, vec![0, 1]);
}
