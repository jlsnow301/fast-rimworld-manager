use quick_xml::events::Event;
use quick_xml::Reader;

#[derive(Clone, Copy)]
enum AboutField {
    Name,
    Author,
    PackageId,
    Description,
}
use super::model::ModDependency;
pub(super) fn parse_about_xml(xml: &str) -> Option<(String, Option<String>, String, String)> {
    let mut reader = Reader::from_str(xml);
    let mut current_field = None;
    let mut depth = 0usize;
    let mut name = String::new();
    let mut author = String::new();
    let mut package_id = String::new();
    let mut description = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                if depth == 1 {
                    let tag = element.local_name();
                    current_field = if tag.as_ref().eq_ignore_ascii_case("name") {
                        Some(AboutField::Name)
                    } else if tag.as_ref().eq_ignore_ascii_case("author") {
                        Some(AboutField::Author)
                    } else if tag.as_ref().eq_ignore_ascii_case("packageId") {
                        Some(AboutField::PackageId)
                    } else if tag.as_ref().eq_ignore_ascii_case("description") {
                        Some(AboutField::Description)
                    } else {
                        None
                    };
                }
                depth += 1;
            }
            Ok(Event::Text(text)) => {
                let unescaped = quick_xml::escape::unescape(text.as_ref()).ok()?;
                append_about_text(
                    current_field,
                    &unescaped,
                    &mut name,
                    &mut author,
                    &mut package_id,
                    &mut description,
                );
            }
            Ok(Event::GeneralRef(reference)) => {
                let entity = format!("&{};", reference.as_ref());
                let unescaped = quick_xml::escape::unescape(&entity).ok()?;
                append_about_text(
                    current_field,
                    &unescaped,
                    &mut name,
                    &mut author,
                    &mut package_id,
                    &mut description,
                );
            }
            Ok(Event::End(_)) => {
                if depth == 2 {
                    current_field = None;
                }
                depth = depth.saturating_sub(1);
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(_) => return None,
        }
    }

    let package_id = package_id.trim();
    if package_id.is_empty() {
        return None;
    }
    let name = name.trim();
    let author = author.trim();
    Some((
        if name.is_empty() {
            package_id.to_string()
        } else {
            name.to_string()
        },
        (!author.is_empty()).then(|| author.to_string()),
        package_id.to_string(),
        description.trim().to_string(),
    ))
}

fn append_about_text(
    field: Option<AboutField>,
    value: &str,
    name: &mut String,
    author: &mut String,
    package_id: &mut String,
    description: &mut String,
) {
    match field {
        Some(AboutField::Name) => name.push_str(value),
        Some(AboutField::Author) => author.push_str(value),
        Some(AboutField::PackageId) => package_id.push_str(value),
        Some(AboutField::Description) => description.push_str(value),
        None => {}
    }
}

pub(super) struct ParsedAboutRules {
    pub(super) load_after: Vec<String>,
    pub(super) load_before: Vec<String>,
    pub(super) incompatible_with: Vec<String>,
}

#[derive(Clone, Copy)]
enum AboutRuleList {
    After,
    Before,
    IncompatibleWith,
}

pub(super) fn parse_about_rules(xml: &str) -> ParsedAboutRules {
    let mut reader = Reader::from_str(xml);
    let mut rule = None;
    let mut in_list_item = false;
    let mut item = String::new();
    let mut parsed = ParsedAboutRules {
        load_after: Vec::new(),
        load_before: Vec::new(),
        incompatible_with: Vec::new(),
    };

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                let tag = element.local_name();
                rule = if tag.as_ref().eq_ignore_ascii_case("loadAfter") {
                    Some(AboutRuleList::After)
                } else if tag.as_ref().eq_ignore_ascii_case("loadBefore") {
                    Some(AboutRuleList::Before)
                } else if tag.as_ref().eq_ignore_ascii_case("incompatibleWith") {
                    Some(AboutRuleList::IncompatibleWith)
                } else {
                    rule
                };
                if rule.is_some() && tag.as_ref().eq_ignore_ascii_case("li") {
                    in_list_item = true;
                    item.clear();
                }
            }
            Ok(Event::Text(text)) if in_list_item => {
                let Ok(text) = quick_xml::escape::unescape(text.as_ref()) else {
                    continue;
                };
                item.push_str(&text);
            }
            Ok(Event::GeneralRef(reference)) if in_list_item => {
                let entity = format!("&{};", reference.as_ref());
                let Ok(text) = quick_xml::escape::unescape(&entity) else {
                    continue;
                };
                item.push_str(&text);
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("li") && in_list_item {
                    let package_id = item.trim();
                    if !package_id.is_empty() {
                        match rule {
                            Some(AboutRuleList::After) => {
                                parsed.load_after.push(package_id.to_string())
                            }
                            Some(AboutRuleList::Before) => {
                                parsed.load_before.push(package_id.to_string())
                            }
                            Some(AboutRuleList::IncompatibleWith) => {
                                parsed.incompatible_with.push(package_id.to_string())
                            }
                            None => {}
                        }
                    }
                    in_list_item = false;
                } else if tag.as_ref().eq_ignore_ascii_case("loadAfter")
                    || tag.as_ref().eq_ignore_ascii_case("loadBefore")
                    || tag.as_ref().eq_ignore_ascii_case("incompatibleWith")
                {
                    rule = None;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    parsed
}

pub(super) fn parse_xml_list(xml: &str, container_name: &str) -> Vec<String> {
    let mut reader = Reader::from_str(xml);
    let mut depth = 0usize;
    let mut container_depth = None;
    let mut item_depth = None;
    let mut item = String::new();
    let mut values = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                depth += 1;
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case(container_name) {
                    container_depth = Some(depth);
                } else if container_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    item_depth = Some(depth);
                    item.clear();
                }
            }
            Ok(Event::Text(text)) if item_depth.is_some() => {
                let Ok(text) = quick_xml::escape::unescape(text.as_ref()) else {
                    continue;
                };
                item.push_str(&text);
            }
            Ok(Event::GeneralRef(reference)) if item_depth.is_some() => {
                let entity = format!("&{};", reference.as_ref());
                let Ok(text) = quick_xml::escape::unescape(&entity) else {
                    continue;
                };
                item.push_str(&text);
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if item_depth == Some(depth) && tag.as_ref().eq_ignore_ascii_case("li") {
                    let value = item.trim();
                    if !value.is_empty() {
                        values.push(value.to_string());
                    }
                    item_depth = None;
                }
                if container_depth == Some(depth)
                    && tag.as_ref().eq_ignore_ascii_case(container_name)
                {
                    container_depth = None;
                }
                depth = depth.saturating_sub(1);
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    values
}

#[derive(Clone, Copy)]
enum ModDependencyField {
    PackageId,
    Name,
    AlternativePackageId,
}

pub(super) fn parse_mod_dependencies(xml: &str) -> Vec<ModDependency> {
    let mut reader = Reader::from_str(xml);
    let mut depth = 0usize;
    let mut dependencies_depth = None;
    let mut dependency_depth = None;
    let mut alternatives_depth = None;
    let mut alternative_item_depth = None;
    let mut field = None;
    let mut package_id = String::new();
    let mut name = String::new();
    let mut alternative_package_ids = Vec::new();
    let mut alternative_package_id = String::new();
    let mut dependencies = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                depth += 1;
                let tag = element.local_name();
                if tag.as_ref().eq_ignore_ascii_case("modDependencies") {
                    dependencies_depth = Some(depth);
                } else if dependencies_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    dependency_depth = Some(depth);
                    package_id.clear();
                    name.clear();
                    alternative_package_ids.clear();
                } else if dependency_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("alternativePackageIds")
                {
                    alternatives_depth = Some(depth);
                } else if alternatives_depth == Some(depth - 1)
                    && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    alternative_item_depth = Some(depth);
                    alternative_package_id.clear();
                    field = Some(ModDependencyField::AlternativePackageId);
                } else if dependency_depth == Some(depth - 1) {
                    field = if tag.as_ref().eq_ignore_ascii_case("packageId") {
                        Some(ModDependencyField::PackageId)
                    } else if tag.as_ref().eq_ignore_ascii_case("displayName") {
                        Some(ModDependencyField::Name)
                    } else {
                        None
                    };
                }
            }
            Ok(Event::Text(text)) => {
                if let Ok(text) = quick_xml::escape::unescape(text.as_ref()) {
                    append_dependency_text(
                        field,
                        &text,
                        &mut package_id,
                        &mut name,
                        &mut alternative_package_id,
                    );
                }
            }
            Ok(Event::GeneralRef(reference)) => {
                let entity = format!("&{};", reference.as_ref());
                if let Ok(text) = quick_xml::escape::unescape(&entity) {
                    append_dependency_text(
                        field,
                        &text,
                        &mut package_id,
                        &mut name,
                        &mut alternative_package_id,
                    );
                }
            }
            Ok(Event::End(element)) => {
                let tag = element.local_name();
                if alternative_item_depth == Some(depth) && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    let alternative = alternative_package_id.trim();
                    if !alternative.is_empty() {
                        alternative_package_ids.push(alternative.to_string());
                    }
                    alternative_item_depth = None;
                    field = None;
                } else if alternatives_depth == Some(depth)
                    && tag.as_ref().eq_ignore_ascii_case("alternativePackageIds")
                {
                    alternatives_depth = None;
                } else if dependency_depth == Some(depth) && tag.as_ref().eq_ignore_ascii_case("li")
                {
                    let package_id = package_id.trim();
                    if !package_id.is_empty() {
                        dependencies.push(ModDependency {
                            package_id: package_id.to_string(),
                            name: if name.trim().is_empty() {
                                package_id.to_string()
                            } else {
                                name.trim().to_string()
                            },
                            alternative_package_ids: std::mem::take(&mut alternative_package_ids),
                        });
                    }
                    dependency_depth = None;
                    field = None;
                } else if tag.as_ref().eq_ignore_ascii_case("packageId")
                    || tag.as_ref().eq_ignore_ascii_case("displayName")
                {
                    field = None;
                }
                if dependencies_depth == Some(depth)
                    && tag.as_ref().eq_ignore_ascii_case("modDependencies")
                {
                    dependencies_depth = None;
                }
                depth = depth.saturating_sub(1);
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    dependencies
}

fn append_dependency_text(
    field: Option<ModDependencyField>,
    value: &str,
    package_id: &mut String,
    name: &mut String,
    alternative_package_id: &mut String,
) {
    match field {
        Some(ModDependencyField::PackageId) => package_id.push_str(value),
        Some(ModDependencyField::Name) => name.push_str(value),
        Some(ModDependencyField::AlternativePackageId) => {
            alternative_package_id.push_str(value);
        }
        None => {}
    }
}

#[test]
fn parses_author_from_about_xml_without_guessing_from_package_id() {
    let parsed = parse_about_xml(
		"<ModMetaData><name>Example</name><author> Mod Team &amp; Friends </author><packageId>ModTeam.Example</packageId></ModMetaData>",
	);
    assert_eq!(
        parsed,
        Some((
            "Example".to_string(),
            Some("Mod Team & Friends".to_string()),
            "ModTeam.Example".to_string(),
            String::new(),
        )),
    );

    let without_author =
        parse_about_xml("<ModMetaData><packageId>ModTeam.Example</packageId></ModMetaData>");
    assert_eq!(without_author.map(|(_, author, _, _)| author), Some(None));
}
#[test]
fn parses_mod_dependencies_with_nested_alternative_ids() {
    let dependencies = parse_mod_dependencies(
		"<ModMetaData><modDependencies><li><packageId>Author.Framework</packageId><alternativePackageIds><li>Author.Framework.Continued</li></alternativePackageIds><displayName>Framework &amp; More</displayName></li><li><packageId>Author.Other</packageId></li></modDependencies></ModMetaData>",
	);

    assert_eq!(
        dependencies,
        vec![
            ModDependency {
                package_id: "Author.Framework".to_string(),
                name: "Framework & More".to_string(),
                alternative_package_ids: vec!["Author.Framework.Continued".to_string()],
            },
            ModDependency {
                package_id: "Author.Other".to_string(),
                name: "Author.Other".to_string(),
                alternative_package_ids: Vec::new(),
            },
        ],
    );
}

#[test]
fn parses_about_order_incompatibility_and_supported_version_lists() {
    let xml = "<ModMetaData><loadAfter><li>Author.Framework</li></loadAfter><loadBefore><li>Author.Patch</li></loadBefore><incompatibleWith><li>Author.Conflict</li></incompatibleWith><supportedVersions><li>1.5</li><li>1.6</li></supportedVersions></ModMetaData>";
    let rules = parse_about_rules(xml);

    assert_eq!(rules.load_after, ["Author.Framework"]);
    assert_eq!(rules.load_before, ["Author.Patch"]);
    assert_eq!(rules.incompatible_with, ["Author.Conflict"]);
    assert_eq!(parse_xml_list(xml, "supportedVersions"), ["1.5", "1.6"]);
}
#[test]
fn about_package_id_ignores_nested_dependency_package_ids() {
    let parsed = parse_about_xml(
            "<ModMetaData><name>1trickPwnyta's Anomaly Patch</name><packageId>anomalypatch.1trickPwnyta</packageId><modDependencies><li><packageId>brrainz.harmony</packageId></li></modDependencies></ModMetaData>",
        );

    assert_eq!(
        parsed,
        Some((
            "1trickPwnyta's Anomaly Patch".to_string(),
            None,
            "anomalypatch.1trickPwnyta".to_string(),
            String::new(),
        )),
    );
}
#[test]
fn parses_escaped_description_for_preview() {
    let parsed = parse_about_xml(
            "<ModMetaData><name>Mod &amp; More</name><packageId>Author.Mod</packageId><description>Details &amp; requirements</description></ModMetaData>",
        );

    assert_eq!(
        parsed,
        Some((
            "Mod & More".to_string(),
            None,
            "Author.Mod".to_string(),
            "Details & requirements".to_string(),
        ))
    );
}
