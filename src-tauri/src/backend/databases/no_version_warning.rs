use std::collections::HashSet;

use quick_xml::events::Event;
use quick_xml::Reader;

pub(crate) fn parse_package_ids(contents: &[u8]) -> Result<HashSet<String>, String> {
    let xml = std::str::from_utf8(contents)
        .map_err(|error| format!("The warning database is not UTF-8: {error}"))?;
    let mut reader = Reader::from_str(xml);
    let mut depth = 0usize;
    let mut has_root = false;
    let mut in_package_id = false;
    let mut package_id = String::new();
    let mut package_ids = HashSet::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) => {
                let tag = element.local_name();
                if depth == 0 {
                    has_root = tag.as_ref().eq_ignore_ascii_case("ModIdsToFix");
                    if !has_root {
                        return Err("The database must have a ModIdsToFix root element.".into());
                    }
                } else if depth == 1 && tag.as_ref().eq_ignore_ascii_case("li") {
                    in_package_id = true;
                    package_id.clear();
                }
                depth += 1;
            }
            Ok(Event::Text(text)) if in_package_id => {
                let unescaped = quick_xml::escape::unescape(text.as_ref())
                    .map_err(|error| format!("Could not decode package ID: {error}"))?;
                package_id.push_str(&unescaped);
            }
            Ok(Event::End(element)) => {
                if depth == 2
                    && element.local_name().as_ref().eq_ignore_ascii_case("li")
                    && in_package_id
                {
                    let package_id = package_id.trim();
                    if !package_id.is_empty() {
                        package_ids.insert(package_id.to_ascii_lowercase());
                    }
                    in_package_id = false;
                }
                depth = depth.saturating_sub(1);
            }
            Ok(Event::Empty(element)) => {
                if depth == 0 {
                    has_root = element
                        .local_name()
                        .as_ref()
                        .eq_ignore_ascii_case("ModIdsToFix");
                    if !has_root {
                        return Err("The database must have a ModIdsToFix root element.".into());
                    }
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(format!("Could not parse warning database: {error}")),
        }
    }

    if !has_root || depth != 0 {
        return Err("The database must have a complete ModIdsToFix root element.".into());
    }
    Ok(package_ids)
}

#[cfg(test)]
mod tests {
    use super::parse_package_ids;

    #[test]
    fn parses_and_normalizes_mod_package_ids() {
        let ids = parse_package_ids(
            br#"<?xml version="1.0"?><ModIdsToFix><li>Example.Mod</li><li>other.mod</li></ModIdsToFix>"#,
        )
        .expect("valid warning database should parse");

        assert!(ids.contains("example.mod"));
        assert!(ids.contains("other.mod"));
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn rejects_unrecognized_or_malformed_database_xml() {
        assert!(parse_package_ids(b"<Other><li>example.mod</li></Other>").is_err());
        assert!(parse_package_ids(b"<ModIdsToFix><li>example.mod</ModIdsToFix>").is_err());
    }
}
