use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use super::model::{DatabaseDownloadResult, DatabaseKind};
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
        }
    }

    fn endpoint(self) -> &'static str {
        match self {
            Self::CommunityRules => {
                "https://raw.githubusercontent.com/RimSort/Community-Rules-Database/main/communityRules.json"
            }
            Self::SteamWorkshop => {
                "https://raw.githubusercontent.com/RimSort/Steam-Workshop-Database/main/steamDB.json"
            }
        }
    }

    fn root_key(self) -> &'static str {
        match self {
            Self::CommunityRules => "rules",
            Self::SteamWorkshop => "database",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::CommunityRules => "Community Rules",
            Self::SteamWorkshop => "Steam Workshop",
        }
    }
}

pub(crate) async fn download_database(
    app: tauri::AppHandle,
    database: DatabaseKind,
) -> Result<DatabaseDownloadResult, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Could not resolve the database directory: {error}"))?
        .join("databases");
    download_database_from_url(database, database.endpoint(), &directory).await
}

async fn download_database_from_url(
    database: DatabaseKind,
    endpoint: &str,
    directory: &Path,
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
    save_database_atomically(directory, database.file_name(), &contents)?;

    Ok(DatabaseDownloadResult {
        database,
        bytes_downloaded: contents.len() as u64,
    })
}

fn validate_database_contents(database: DatabaseKind, contents: &[u8]) -> Result<(), String> {
    let value: Value = serde_json::from_slice(contents).map_err(|error| {
        format!(
            "The downloaded {} database is not valid JSON: {error}",
            database.display_name()
        )
    })?;
    if !value.get(database.root_key()).is_some_and(Value::is_object) {
        return Err(format!(
            "The downloaded {} database is missing its '{}' object.",
            database.display_name(),
            database.root_key()
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
            ),
            (
                DatabaseKind::SteamWorkshop,
                r#"{"version":1,"database":{"123":{}}}"#,
                "steamDB.json",
            ),
        ];

        for (database, body, file_name) in cases {
            let endpoint = serve_once("200 OK", body).await;
            let result = download_database_from_url(database, &endpoint, &directory)
                .await
                .expect("compatible database should download");

            assert_eq!(result.database, database);
            assert_eq!(result.bytes_downloaded, body.len() as u64);
            assert_eq!(
                fs::read(directory.join(file_name)).unwrap(),
                body.as_bytes()
            );
        }

        fs::remove_dir_all(directory).expect("download directory should be removed");
    }

    #[tokio::test]
    async fn rejects_invalid_database_without_replacing_previous_download() {
        let directory = unique_temp_directory("invalid-database");
        fs::create_dir_all(&directory).expect("download directory should be created");
        let destination = directory.join("communityRules.json");
        fs::write(&destination, b"previous database").expect("previous database should be written");
        let endpoint = serve_once("200 OK", r#"{"rules":[]}"#).await;

        let result =
            download_database_from_url(DatabaseKind::CommunityRules, &endpoint, &directory).await;

        assert!(result.is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"previous database");
        fs::remove_dir_all(directory).expect("download directory should be removed");
    }

    #[tokio::test]
    async fn rejects_http_errors_without_creating_database_files() {
        let directory = unique_temp_directory("failed-database");
        let endpoint = serve_once("503 Service Unavailable", "{}").await;

        let result =
            download_database_from_url(DatabaseKind::CommunityRules, &endpoint, &directory).await;

        assert!(result.is_err());
        assert!(!directory.exists());
    }

    #[test]
    fn rejects_non_json_and_unrecognized_database_shapes() {
        assert!(validate_database_contents(DatabaseKind::CommunityRules, b"not json").is_err());
        assert!(
            validate_database_contents(DatabaseKind::CommunityRules, br#"{"rules":[]}"#).is_err()
        );
        assert!(
            validate_database_contents(DatabaseKind::SteamWorkshop, br#"{"database":{}}"#).is_ok()
        );
    }
    #[test]
    fn uses_frontend_database_names_and_response_fields() {
        let database: DatabaseKind = serde_json::from_str("\"communityRules\"")
            .expect("frontend database name should deserialize");
        assert_eq!(database, DatabaseKind::CommunityRules);

        let result = DatabaseDownloadResult {
            database,
            bytes_downloaded: 42,
        };
        assert_eq!(
            serde_json::to_value(result).expect("download response should serialize"),
            serde_json::json!({
                "database": "communityRules",
                "bytesDownloaded": 42
            })
        );
    }
}
