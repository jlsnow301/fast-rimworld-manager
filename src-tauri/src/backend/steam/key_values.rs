use std::collections::HashMap;
#[derive(Clone, Debug, PartialEq)]
enum KeyValuesToken {
    Text(String),
    Open,
    Close,
}

#[derive(Clone, Debug, PartialEq)]
enum KeyValuesValue {
    Text(String),
    Object(HashMap<String, KeyValuesValue>),
}

impl KeyValuesValue {
    fn as_text(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Object(_) => None,
        }
    }

    fn as_object(&self) -> Option<&HashMap<String, KeyValuesValue>> {
        match self {
            Self::Text(_) => None,
            Self::Object(value) => Some(value),
        }
    }
}
pub(super) fn parse_local_workshop_update_times(
    contents: &str,
) -> Result<HashMap<String, u64>, String> {
    let contents = contents.trim_start_matches('\u{feff}');
    let tokens = tokenize_key_values(contents)?;
    let mut cursor = 0;
    let root = parse_key_values_object(&tokens, &mut cursor, false)?;
    if cursor != tokens.len() {
        return Err("Steam Workshop metadata contains unexpected trailing data.".to_string());
    }
    let app_workshop = object_value(&root, "AppWorkshop")
        .ok_or_else(|| "Steam Workshop metadata is missing AppWorkshop.".to_string())?;
    let mut timestamps = HashMap::new();
    for table_name in ["WorkshopItemDetails", "WorkshopItemsInstalled"] {
        let Some(items) = object_value(app_workshop, table_name) else {
            continue;
        };
        for (published_file_id, item) in items {
            if timestamps.contains_key(published_file_id) {
                continue;
            }
            let Some(time_updated) = item
                .as_object()
                .and_then(|fields| fields.get("timeupdated"))
                .and_then(KeyValuesValue::as_text)
                .and_then(|value| value.parse::<u64>().ok())
                .filter(|timestamp| *timestamp > 0)
            else {
                continue;
            };
            timestamps.insert(published_file_id.clone(), time_updated);
        }
    }
    Ok(timestamps)
}

fn object_value<'a>(
    values: &'a HashMap<String, KeyValuesValue>,
    key: &str,
) -> Option<&'a HashMap<String, KeyValuesValue>> {
    values.get(key)?.as_object()
}

fn tokenize_key_values(contents: &str) -> Result<Vec<KeyValuesToken>, String> {
    let mut characters = contents.chars().peekable();
    let mut tokens = Vec::new();
    while let Some(character) = characters.next() {
        match character {
            character if character.is_whitespace() => {}
            '{' => tokens.push(KeyValuesToken::Open),
            '}' => tokens.push(KeyValuesToken::Close),
            '/' if characters.peek() == Some(&'/') => {
                characters.next();
                for character in characters.by_ref() {
                    if character == '\n' {
                        break;
                    }
                }
            }
            '"' => {
                let mut value = String::new();
                let mut closed = false;
                while let Some(character) = characters.next() {
                    match character {
                        '"' => {
                            closed = true;
                            break;
                        }
                        '\\' => {
                            let escaped = characters.next().ok_or_else(|| {
                                "Steam Workshop metadata has an incomplete escape.".to_string()
                            })?;
                            value.push(escaped);
                        }
                        character => value.push(character),
                    }
                }
                if !closed {
                    return Err("Steam Workshop metadata has an unterminated string.".to_string());
                }
                tokens.push(KeyValuesToken::Text(value));
            }
            character => {
                let mut value = String::from(character);
                while characters
                    .peek()
                    .is_some_and(|next| !next.is_whitespace() && *next != '{' && *next != '}')
                {
                    if let Some(character) = characters.next() {
                        value.push(character);
                    }
                }
                tokens.push(KeyValuesToken::Text(value));
            }
        }
    }
    Ok(tokens)
}

fn parse_key_values_object(
    tokens: &[KeyValuesToken],
    cursor: &mut usize,
    nested: bool,
) -> Result<HashMap<String, KeyValuesValue>, String> {
    let mut object = HashMap::new();
    while let Some(token) = tokens.get(*cursor) {
        match token {
            KeyValuesToken::Close if nested => {
                *cursor += 1;
                return Ok(object);
            }
            KeyValuesToken::Close => {
                return Err("Steam Workshop metadata has an unmatched closing brace.".to_string());
            }
            KeyValuesToken::Open => {
                return Err("Steam Workshop metadata has an unmatched opening brace.".to_string());
            }
            KeyValuesToken::Text(key) => {
                let key = key.clone();
                *cursor += 1;
                match tokens.get(*cursor) {
                    Some(KeyValuesToken::Text(value)) => {
                        object.insert(key, KeyValuesValue::Text(value.clone()));
                        *cursor += 1;
                    }
                    Some(KeyValuesToken::Open) => {
                        *cursor += 1;
                        let child = parse_key_values_object(tokens, cursor, true)?;
                        object.insert(key, KeyValuesValue::Object(child));
                    }
                    _ => {
                        return Err(
                            "Steam Workshop metadata has a key without a value.".to_string()
                        );
                    }
                }
            }
        }
    }
    if nested {
        return Err("Steam Workshop metadata has an unclosed object.".to_string());
    }
    Ok(object)
}
#[test]
fn parses_installed_times_from_workshop_acf_metadata() {
    let contents = r#"
            "AppWorkshop" {
                "WorkshopItemsInstalled" {
                    "111" { "timeupdated" "1700000001" }
                }
                "WorkshopItemDetails" {
                    "111" { "timeupdated" "1700000002" }
                    "222" { "timeupdated" "0" }
                    "333" { "manifest" "123" }
                }
            }
        "#;

    let timestamps =
        parse_local_workshop_update_times(contents).expect("valid ACF metadata should parse");

    assert_eq!(timestamps.get("111"), Some(&1700000002));
    assert!(!timestamps.contains_key("222"));
    assert!(!timestamps.contains_key("333"));
}
