use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Duration;

use serde::Deserialize;

use super::model::{OutdatedWorkshopMod, WorkshopUpdateCheckResult};
use crate::backend::mods::{inventory::collect_installed_mods, model::InstalledMod};
use crate::backend::paths::model::PathSettings;

const PUBLISHED_FILE_DETAILS_URL: &str =
    "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_PUBLISHED_FILE_IDS_PER_REQUEST: usize = 100;
pub(crate) async fn check_outdated_mods(
    settings: &PathSettings,
) -> Result<WorkshopUpdateCheckResult, String> {
    check_outdated_mods_from_endpoint(settings, PUBLISHED_FILE_DETAILS_URL).await
}

async fn check_outdated_mods_from_endpoint(
    settings: &PathSettings,
    endpoint: &str,
) -> Result<WorkshopUpdateCheckResult, String> {
    let installed_mods = collect_installed_mods(settings)?;
    let workshop_mods = installed_mods
        .iter()
        .filter(|mod_entry| mod_entry.source == "workshop");
    let workshop_mods: Vec<&InstalledMod> = workshop_mods.collect();
    if workshop_mods.is_empty() {
        return Ok(WorkshopUpdateCheckResult::default());
    }

    let local_times = read_local_workshop_update_times(&settings.workshop_path)?;
    let mut checked_ids = HashSet::new();
    let mut candidates = Vec::new();
    let mut skipped_count = 0;
    for mod_entry in workshop_mods {
        let Some(published_file_id) = mod_entry.published_file_id.as_deref() else {
            skipped_count += 1;
            continue;
        };
        let Some(&installed_time_updated) = local_times.get(published_file_id) else {
            skipped_count += 1;
            continue;
        };
        if checked_ids.insert(published_file_id) {
            candidates.push((mod_entry, installed_time_updated));
        }
    }

    let mut steam_times = HashMap::new();
    for batch in candidates.chunks(MAX_PUBLISHED_FILE_IDS_PER_REQUEST) {
        let published_file_ids: Vec<&str> = batch
            .iter()
            .filter_map(|(mod_entry, _)| mod_entry.published_file_id.as_deref())
            .collect();
        steam_times.extend(fetch_published_file_updates(endpoint, &published_file_ids).await?);
    }

    Ok(compare_update_times(
        candidates,
        &steam_times,
        skipped_count,
    ))
}

fn read_local_workshop_update_times(workshop_path: &str) -> Result<HashMap<String, u64>, String> {
    let workshop_content_path = Path::new(workshop_path);
    let workshop_root = workshop_content_path
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| "Could not locate Steam's Workshop metadata file.".to_string())?;
    let acf_path = workshop_root.join("appworkshop_294100.acf");
    let contents = fs::read_to_string(&acf_path).map_err(|error| {
        format!(
            "Could not read Steam Workshop metadata at {}: {error}",
            acf_path.display()
        )
    })?;
    super::key_values::parse_local_workshop_update_times(&contents)
}

async fn fetch_published_file_updates(
    endpoint: &str,
    published_file_ids: &[&str],
) -> Result<HashMap<String, u64>, String> {
    if published_file_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "Could not initialize the Steam Workshop client.".to_string())?;
    let mut parameters = Vec::with_capacity(published_file_ids.len() + 1);
    parameters.push((
        "itemcount".to_string(),
        published_file_ids.len().to_string(),
    ));
    for (index, published_file_id) in published_file_ids.iter().enumerate() {
        parameters.push((
            format!("publishedfileids[{index}]"),
            (*published_file_id).to_string(),
        ));
    }
    let response = client
        .post(endpoint)
        .form(&parameters)
        .send()
        .await
        .map_err(|_| "Could not reach the Steam Workshop API.".to_string())?
        .error_for_status()
        .map_err(|_| "Steam rejected the Workshop update check.".to_string())?;
    let body = response
        .text()
        .await
        .map_err(|_| "Could not read Steam Workshop update data.".to_string())?;
    let response: PublishedFileDetailsResponse = serde_json::from_str(&body)
        .map_err(|_| "Steam returned invalid Workshop update data.".to_string())?;
    let requested_ids: HashSet<&str> = published_file_ids.iter().copied().collect();
    Ok(response
        .response
        .published_file_details
        .into_iter()
        .filter_map(|details| {
            if details.result != 1 || !requested_ids.contains(details.published_file_id.as_str()) {
                return None;
            }
            let timestamp = details.time_updated.filter(|timestamp| *timestamp > 0)?;
            Some((details.published_file_id, timestamp))
        })
        .collect())
}

fn compare_update_times(
    candidates: Vec<(&InstalledMod, u64)>,
    steam_times: &HashMap<String, u64>,
    mut skipped_count: usize,
) -> WorkshopUpdateCheckResult {
    let mut outdated_mods = Vec::new();
    let mut checked_count = 0;
    for (mod_entry, installed_time_updated) in candidates {
        let Some(published_file_id) = mod_entry.published_file_id.as_deref() else {
            skipped_count += 1;
            continue;
        };
        let Some(&steam_time_updated) = steam_times.get(published_file_id) else {
            skipped_count += 1;
            continue;
        };
        checked_count += 1;
        if steam_time_updated > installed_time_updated {
            outdated_mods.push(OutdatedWorkshopMod {
                name: mod_entry.name.clone(),
                package_id: mod_entry.package_id.clone(),
                published_file_id: published_file_id.to_string(),
                installed_time_updated,
                steam_time_updated,
            });
        }
    }
    WorkshopUpdateCheckResult {
        checked_count,
        skipped_count,
        outdated_mods,
    }
}

#[derive(Deserialize)]
struct PublishedFileDetailsResponse {
    response: PublishedFileDetailsResponseBody,
}

#[derive(Deserialize)]
struct PublishedFileDetailsResponseBody {
    #[serde(default, rename = "publishedfiledetails")]
    published_file_details: Vec<PublishedFileDetails>,
}

#[derive(Deserialize)]
struct PublishedFileDetails {
    #[serde(default)]
    result: u32,
    #[serde(default, rename = "publishedfileid")]
    published_file_id: String,
    #[serde(default, rename = "time_updated")]
    time_updated: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn installed_mod(published_file_id: &str) -> InstalledMod {
        InstalledMod {
            name: format!("Sample {published_file_id}"),
            author: None,
            package_id: format!("sample.mod{published_file_id}"),
            description: String::new(),
            published_file_id: Some(published_file_id.to_string()),
            load_after: Vec::new(),
            load_before: Vec::new(),
            incompatible_with: Vec::new(),
            supported_versions: Vec::new(),
            dependencies: Vec::new(),
            path: format!("C:/Workshop/{published_file_id}"),
            source: "workshop".to_string(),
        }
    }

    #[test]
    fn compares_remote_update_time_against_installed_workshop_time() {
        let installed = [installed_mod("111"), installed_mod("222")];
        let candidates = vec![(&installed[0], 100), (&installed[1], 200)];
        let steam_times = HashMap::from([("111".to_string(), 101), ("222".to_string(), 200)]);

        let result = compare_update_times(candidates, &steam_times, 0);

        assert_eq!(result.checked_count, 2);
        assert_eq!(result.outdated_mods.len(), 1);
        assert_eq!(result.outdated_mods[0].published_file_id, "111");
    }

    #[test]
    fn counts_items_without_steam_metadata_as_skipped() {
        let installed = [installed_mod("111")];
        let candidates = vec![(&installed[0], 100)];

        let result = compare_update_times(candidates, &HashMap::new(), 2);

        assert_eq!(result.skipped_count, 3);
    }

    #[tokio::test]
    async fn requests_a_batch_of_published_file_details() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("mock Steam server should bind");
        let address = listener
            .local_addr()
            .expect("server address should be available");
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.expect("request should connect");
            let mut request = Vec::new();
            loop {
                let mut chunk = [0; 1024];
                let read = stream.read(&mut chunk).await.expect("request should read");
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..read]);
                let Some(header_end) = request.windows(4).position(|window| window == b"\r\n\r\n")
                else {
                    continue;
                };
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().ok())
                            .flatten()
                    })
                    .unwrap_or_default();
                if request.len() >= header_end + 4 + content_length {
                    break;
                }
            }
            let request = String::from_utf8(request).expect("request should be UTF-8");
            assert!(request.starts_with("POST /details HTTP/1.1"));
            assert!(request.contains("itemcount=2"));
            assert!(request.contains("publishedfileids%5B0%5D=111"));
            assert!(request.contains("publishedfileids%5B1%5D=222"));
            let body = r#"{"response":{"publishedfiledetails":[{"publishedfileid":"111","result":1,"time_updated":100},{"publishedfileid":"222","result":9,"time_updated":200}]}}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
        });

        let updates =
            fetch_published_file_updates(&format!("http://{address}/details"), &["111", "222"])
                .await
                .expect("Steam response should parse");

        assert_eq!(updates, HashMap::from([("111".to_string(), 100)]));
        server.await.expect("server should complete");
    }
    #[tokio::test]
    async fn checks_installed_workshop_mods_against_steam_timestamps() {
        use std::time::{SystemTime, UNIX_EPOCH};
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpListener;

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the epoch")
            .as_nanos();
        let steam_root = std::env::temp_dir().join(format!("workshop-update-{nonce}"));
        let workshop_path = steam_root.join("steamapps/workshop/content/294100");
        let mod_directory = workshop_path.join("111");
        fs::create_dir_all(mod_directory.join("About"))
            .expect("sample Workshop mod should be created");
        fs::write(
            mod_directory.join("About/About.xml"),
            "<ModMetaData><name>Workshop Mod</name><packageId>sample.workshop.mod</packageId><description>Sample</description></ModMetaData>",
        )
        .expect("sample About.xml should be written");
        fs::write(
            steam_root.join("steamapps/workshop/appworkshop_294100.acf"),
            r#""AppWorkshop" { "WorkshopItemDetails" { "111" { "timeupdated" "100" } } }"#,
        )
        .expect("sample Workshop metadata should be written");
        let settings = PathSettings {
            workshop_path: workshop_path.to_string_lossy().into_owned(),
            ..PathSettings::default()
        };

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("mock Steam server should bind");
        let address = listener
            .local_addr()
            .expect("server address should be available");
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.expect("request should connect");
            let mut request = Vec::new();
            loop {
                let mut chunk = [0; 1024];
                let read = stream.read(&mut chunk).await.expect("request should read");
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..read]);
                let Some(header_end) = request.windows(4).position(|window| window == b"\r\n\r\n")
                else {
                    continue;
                };
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().ok())
                            .flatten()
                    })
                    .unwrap_or_default();
                if request.len() >= header_end + 4 + content_length {
                    break;
                }
            }
            let request = String::from_utf8(request).expect("request should be UTF-8");
            assert!(request.contains("publishedfileids%5B0%5D=111"));
            let body = r#"{"response":{"publishedfiledetails":[{"publishedfileid":"111","result":1,"time_updated":200}]}}"#;
            let response = format!(
				"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
        });

        let result =
            check_outdated_mods_from_endpoint(&settings, &format!("http://{address}/details"))
                .await
                .expect("update check should succeed");

        assert_eq!(result.checked_count, 1);
        assert_eq!(result.skipped_count, 0);
        assert_eq!(result.outdated_mods[0].installed_time_updated, 100);
        assert_eq!(result.outdated_mods[0].steam_time_updated, 200);
        server.await.expect("server should complete");
        fs::remove_dir_all(steam_root).expect("fixture directory should be removed");
    }
}
