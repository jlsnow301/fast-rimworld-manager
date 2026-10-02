use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, UNIX_EPOCH};

use super::model::{DatabaseDownloadResult, DatabaseFileStatus, DatabaseKind};
use serde_json::Value;
use tauri::Manager;

const MAX_DATABASE_BYTES: usize = 128 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);
static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

impl DatabaseKind {
    fn file_name(self) -> &'static str {
        match self {
            Self::CommunityRules => "communityRules.json",
            Self::SteamWorkshop => "steamDB.json",
            Self::NoVersionWarning => "ModIdsToFix.xml",
        }
    }

    fn endpoint(self, game_version: &str) -> Result<String, String> {
        match self {
            Self::CommunityRules => Ok(
                "https://raw.githubusercontent.com/RimSort/Community-Rules-Database/main/communityRules.json"
                    .to_string(),
            ),
            Self::SteamWorkshop => Ok(
                "https://raw.githubusercontent.com/RimSort/Steam-Workshop-Database/main/steamDB.json"
                    .to_string(),
            ),
            Self::NoVersionWarning => Ok(format!(
                "https://raw.githubusercontent.com/emipa606/NoVersionWarning/main/{}/ModIdsToFix.xml",
                normalized_game_version(game_version)?
            )),
        }
    }

    fn root_key(self) -> Option<&'static str> {
        match self {
            Self::CommunityRules => Some("rules"),
            Self::SteamWorkshop => Some("database"),
            Self::NoVersionWarning => None,
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::CommunityRules => "Community Rules",
            Self::SteamWorkshop => "Steam Workshop",
            Self::NoVersionWarning => "No Version Warning",
        }
    }
}

fn normalized_game_version(version: &str) -> Result<String, String> {
    let version = version.trim().trim_start_matches(['v', 'V']);
    let mut components = version.split('.');
    let major = components.next().unwrap_or_default();
    let minor = components.next().unwrap_or_default();
    if major.is_empty()
        || minor.is_empty()
        || !major.chars().all(|character| character.is_ascii_digit())
        || !minor.chars().all(|character| character.is_ascii_digit())
    {
        return Err(format!("Invalid RimWorld game version: {version}"));
    }
    Ok(format!("{major}.{minor}"))
}

fn database_file_path(
    directory: &Path,
    database: DatabaseKind,
    game_version: &str,
) -> Result<PathBuf, String> {
    let directory = if database == DatabaseKind::NoVersionWarning {
        directory.join(normalized_game_version(game_version)?)
    } else {
        directory.to_path_buf()
    };
    Ok(directory.join(database.file_name()))
}

fn database_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join("databases"))
        .map_err(|error| format!("Could not resolve the database directory: {error}"))
}

pub(crate) fn list_database_statuses(
    app: tauri::AppHandle,
) -> Result<Vec<DatabaseFileStatus>, String> {
    let directory = database_directory(&app)?;
    database_statuses_in(&directory)
}

fn database_statuses_in(directory: &Path) -> Result<Vec<DatabaseFileStatus>, String> {
    [
        DatabaseKind::CommunityRules,
        DatabaseKind::SteamWorkshop,
        DatabaseKind::NoVersionWarning,
    ]
    .into_iter()
    .map(|database| {
        let last_modified = if database == DatabaseKind::NoVersionWarning {
            latest_version_warning_database_modified_at(directory)?
        } else {
            database_file_modified_at(&directory.join(database.file_name()))?
        };
        Ok(DatabaseFileStatus {
            database,
            last_modified,
        })
    })
    .collect()
}

fn latest_version_warning_database_modified_at(directory: &Path) -> Result<Option<u64>, String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not list database versions: {error}")),
    };
    let mut latest = None;
    for entry in entries {
        let entry = entry.map_err(|error| format!("Could not list database versions: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("Could not inspect database version: {error}"))?
            .is_dir()
        {
            continue;
        }
        let modified_at = database_file_modified_at(
            &entry
                .path()
                .join(DatabaseKind::NoVersionWarning.file_name()),
        )?;
        latest = latest.max(modified_at);
    }
    Ok(latest)
}

pub(crate) async fn download_database(
    app: tauri::AppHandle,
    database: DatabaseKind,
    game_version: String,
) -> Result<DatabaseDownloadResult, String> {
    let endpoint = database.endpoint(&game_version)?;
    let directory = database_directory(&app)?;
    download_database_from_url(database, &endpoint, &directory, &game_version).await
}

async fn download_database_from_url(
    database: DatabaseKind,
    endpoint: &str,
    directory: &Path,
    game_version: &str,
) -> Result<DatabaseDownloadResult, String> {
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|error| format!("Could not prepare the database download: {error}"))?;
    let mut response = client.get(endpoint).send().await.map_err(|error| {
        format!(
            "Could not download {} database: {error}",
            database.display_name()
        )
    })?;
    if !response.status().is_success() {
        return Err(format!(
            "Could not download {} database: server returned {}.",
            database.display_name(),
            response.status()
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_DATABASE_BYTES as u64)
    {
        return Err(format!(
            "The {} database exceeds the {} MiB download limit.",
            database.display_name(),
            MAX_DATABASE_BYTES / 1024 / 1024
        ));
    }

    let capacity = response
        .content_length()
        .unwrap_or_default()
        .min(8 * 1024 * 1024) as usize;
    let mut contents = Vec::with_capacity(capacity);
    while let Some(chunk) = response.chunk().await.map_err(|error| {
        format!(
            "Could not read {} database: {error}",
            database.display_name()
        )
    })? {
        if contents.len().saturating_add(chunk.len()) > MAX_DATABASE_BYTES {
            return Err(format!(
                "The {} database exceeds the {} MiB download limit.",
                database.display_name(),
                MAX_DATABASE_BYTES / 1024 / 1024
            ));
        }
        contents.extend_from_slice(&chunk);
    }

    validate_database_contents(database, &contents)?;
    let saved_file = database_file_path(directory, database, game_version)?;
    let saved_parent = saved_file
        .parent()
        .ok_or_else(|| "Could not resolve the database file directory.".to_string())?;
    let saved_file = save_database_atomically(saved_parent, database.file_name(), &contents)?;
    let last_modified = database_file_modified_at(&saved_file)?.ok_or_else(|| {
        format!(
            "The {} database file is missing after download.",
            database.display_name()
        )
    })?;

    Ok(DatabaseDownloadResult {
        database,
        bytes_downloaded: contents.len() as u64,
        last_modified,
    })
}

fn validate_database_contents(database: DatabaseKind, contents: &[u8]) -> Result<(), String> {
    if database == DatabaseKind::NoVersionWarning {
        return super::no_version_warning::parse_package_ids(contents)
            .map(|_| ())
            .map_err(|error| {
                format!("The downloaded No Version Warning database is invalid: {error}")
            });
    }

    let value: Value = serde_json::from_slice(contents).map_err(|error| {
        format!(
            "The downloaded {} database is not valid JSON: {error}",
            database.display_name()
        )
    })?;
    let root_key = database.root_key().unwrap_or_default();
    if !value.get(root_key).is_some_and(Value::is_object) {
        return Err(format!(
            "The downloaded {} database is missing its '{}' object.",
            database.display_name(),
            root_key
        ));
    }
    Ok(())
}

fn save_database_atomically(
    directory: &Path,
    file_name: &str,
    contents: &[u8],
) -> Result<PathBuf, String> {
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create the database directory: {error}"))?;

    let destination = directory.join(file_name);
    let temp_file = directory.join(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let write_result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_file)
            .map_err(|error| format!("Could not stage the database download: {error}"))?;
        file.write_all(contents)
            .map_err(|error| format!("Could not write the database download: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Could not flush the database download: {error}"))?;
        fs::rename(&temp_file, &destination)
            .map_err(|error| format!("Could not replace the database file: {error}"))?;
        Ok(destination.clone())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(temp_file);
    }
    write_result
}

fn database_file_modified_at(path: &Path) -> Result<Option<u64>, String> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "Could not inspect database file '{}': {error}",
                path.display()
            ));
        }
    };
    let modified = metadata.modified().map_err(|error| {
        format!(
            "Could not read database file modification time for '{}': {error}",
            path.display()
        )
    })?;
    let duration = modified.duration_since(UNIX_EPOCH).map_err(|_| {
        format!(
            "Database file modification time predates the Unix epoch: '{}'.",
            path.display()
        )
    })?;
    let last_modified = u64::try_from(duration.as_millis()).map_err(|_| {
        format!(
            "Database file modification time is out of range: '{}'.",
            path.display()
        )
    })?;

    Ok(Some(last_modified))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn unique_temp_directory(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("fast-rimworld-manager-{name}-{nonce}"))
    }

    async fn serve_once(status: &'static str, body: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("mock database server should bind");
        let address = listener
            .local_addr()
            .expect("server address should be available");
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.expect("request should connect");
            let mut request = [0; 1024];
            let _ = stream
                .read(&mut request)
                .await
                .expect("request should read");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
        });
        format!("http://{address}/database.json")
    }

    #[tokio::test]
    async fn downloads_and_persists_compatible_database_files() {
        let directory = unique_temp_directory("database-download");
        let cases = [
            (
                DatabaseKind::CommunityRules,
                r#"{"timestamp":1,"rules":{"a.mod":{}}}"#,
                "communityRules.json",
                "1.6",
            ),
            (
                DatabaseKind::SteamWorkshop,
                r#"{"version":1,"database":{"123":{}}}"#,
                "steamDB.json",
                "1.6",
            ),
            (
                DatabaseKind::NoVersionWarning,
                "<ModIdsToFix><li>Example.Mod</li></ModIdsToFix>",
                "1.6/ModIdsToFix.xml",
                "1.6",
            ),
        ];

        for (database, body, file_name, game_version) in cases {
            let endpoint = serve_once("200 OK", body).await;
            let result = download_database_from_url(database, &endpoint, &directory, game_version)
                .await
                .expect("compatible database should download");

            assert_eq!(result.database, database);
            assert_eq!(result.bytes_downloaded, body.len() as u64);
            assert!(result.last_modified > 0);
            assert_eq!(
                Some(result.last_modified),
                database_file_modified_at(&directory.join(file_name))
                    .expect("download timestamp should be readable")
            );
            assert_eq!(
                fs::read(directory.join(file_name)).unwrap(),
                body.as_bytes()
            );
        }

        fs::remove_dir_all(directory).expect("database directory should be removed");
    }

    #[tokio::test]
    async fn rejects_invalid_database_without_replacing_previous_download() {
        let directory = unique_temp_directory("invalid-database");
        fs::create_dir_all(&directory).expect("download directory should be created");
        let destination = directory.join("communityRules.json");
        fs::write(&destination, b"previous database").expect("previous database should be written");
        let endpoint = serve_once("200 OK", r#"{"rules":[]}"#).await;

        let result =
            download_database_from_url(DatabaseKind::CommunityRules, &endpoint, &directory, "1.6")
                .await;

        assert!(result.is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"previous database");
        fs::remove_dir_all(directory).expect("download directory should be removed");
    }

    #[tokio::test]
    async fn rejects_http_errors_without_creating_database_files() {
        let directory = unique_temp_directory("failed-database");
        let endpoint = serve_once("503 Service Unavailable", "{}").await;

        let result =
            download_database_from_url(DatabaseKind::CommunityRules, &endpoint, &directory, "1.6")
                .await;

        assert!(result.is_err());
        assert!(!directory.exists());
    }

    #[test]
    fn rejects_invalid_database_shapes() {
        assert!(validate_database_contents(DatabaseKind::CommunityRules, b"not json").is_err());
        assert!(
            validate_database_contents(DatabaseKind::CommunityRules, br#"{"rules":[]}"#).is_err()
        );
        assert!(
            validate_database_contents(DatabaseKind::SteamWorkshop, br#"{"database":{}}"#).is_ok()
        );
        assert!(validate_database_contents(
            DatabaseKind::NoVersionWarning,
            b"<ModIdsToFix><li>example.mod</li></ModIdsToFix>"
        )
        .is_ok());
        assert!(
            validate_database_contents(DatabaseKind::NoVersionWarning, b"<Invalid />").is_err()
        );
    }
    #[test]
    fn reports_downloaded_and_missing_database_statuses() {
        let directory = unique_temp_directory("database-status");
        fs::create_dir_all(&directory).expect("status directory should be created");
        fs::write(directory.join("communityRules.json"), b"{}")
            .expect("community rules database should be written");
        fs::create_dir_all(directory.join("1.6")).expect("version directory should be created");
        fs::write(
            directory.join("1.6").join("ModIdsToFix.xml"),
            b"<ModIdsToFix />",
        )
        .expect("version warning database should be written");

        let statuses =
            database_statuses_in(&directory).expect("database file statuses should be available");

        assert_eq!(statuses.len(), 3);
        assert_eq!(statuses[0].database, DatabaseKind::CommunityRules);
        assert!(statuses[0].last_modified.is_some());
        assert_eq!(statuses[1].database, DatabaseKind::SteamWorkshop);
        assert_eq!(statuses[1].last_modified, None);
        assert_eq!(statuses[2].database, DatabaseKind::NoVersionWarning);
        assert!(statuses[2].last_modified.is_some());
    }

    #[test]
    fn selects_the_warning_database_for_the_game_version() {
        assert_eq!(
            DatabaseKind::NoVersionWarning
                .endpoint("v1.6.4104 rev573")
                .expect("valid game version should select a database"),
            "https://raw.githubusercontent.com/emipa606/NoVersionWarning/main/1.6/ModIdsToFix.xml"
        );
        assert!(DatabaseKind::NoVersionWarning.endpoint("unknown").is_err());
    }

    #[test]
    fn uses_frontend_database_names_and_response_fields() {
        let database: DatabaseKind = serde_json::from_str("\"communityRules\"")
            .expect("frontend database name should deserialize");
        assert_eq!(database, DatabaseKind::CommunityRules);
        let warning_database: DatabaseKind = serde_json::from_str("\"noVersionWarning\"")
            .expect("frontend warning database name should deserialize");
        assert_eq!(warning_database, DatabaseKind::NoVersionWarning);

        let result = DatabaseDownloadResult {
            database,
            bytes_downloaded: 42,
            last_modified: 1_700_000_000_000,
        };
        assert_eq!(
            serde_json::to_value(result).expect("download response should serialize"),
            serde_json::json!({
                "database": "communityRules",
                "bytesDownloaded": 42,
                "lastModified": 1_700_000_000_000_u64
            })
        );
        let status = DatabaseFileStatus {
            database,
            last_modified: Some(1_700_000_000_000),
        };
        assert_eq!(
            serde_json::to_value(status).expect("status response should serialize"),
            serde_json::json!({
                "database": "communityRules",
                "lastModified": 1_700_000_000_000_u64
            })
        );
    }
}
