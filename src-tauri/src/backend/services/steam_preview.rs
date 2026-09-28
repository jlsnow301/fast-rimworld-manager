use std::time::Duration;

use serde::Deserialize;

use crate::backend::models::steam::SteamModPreview;

const STEAM_DETAILS_URL: &str =
    "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";

#[derive(Deserialize)]
struct SteamApiResponse {
    response: SteamApiDetails,
}

#[derive(Deserialize)]
struct SteamApiDetails {
    #[serde(default, rename = "publishedfiledetails")]
    published_file_details: Vec<SteamPublishedFileDetails>,
}

#[derive(Deserialize)]
struct SteamPublishedFileDetails {
    #[serde(default)]
    result: u32,
    #[serde(default, rename = "publishedfileid")]
    published_file_id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    preview_url: Option<String>,
    #[serde(default)]
    time_updated: Option<u64>,
}

pub(crate) async fn fetch_steam_mod_details(
    published_file_id: String,
) -> Result<Option<SteamModPreview>, String> {
    let published_file_id = published_file_id.trim().to_string();
    if !valid_published_file_id(&published_file_id) {
        return Err("The Steam Workshop ID must contain only digits.".to_string());
    }
    request_steam_mod_details(STEAM_DETAILS_URL, &published_file_id).await
}

async fn request_steam_mod_details(
    endpoint: &str,
    published_file_id: &str,
) -> Result<Option<SteamModPreview>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Could not initialize the Steam client: {error}"))?;
    let parameters = [
        ("itemcount", "1".to_string()),
        ("publishedfileids[0]", published_file_id.to_string()),
    ];
    let response = client
        .post(endpoint)
        .form(&parameters)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| format!("Steam Workshop request failed: {error}"))?;
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read the Steam response: {error}"))?;

    parse_steam_response(&body, published_file_id)
}

fn valid_published_file_id(value: &str) -> bool {
    !value.is_empty()
        && value.chars().all(|character| character.is_ascii_digit())
        && value.parse::<u64>().is_ok_and(|id| id > 0)
}

fn parse_steam_response(body: &str, requested_id: &str) -> Result<Option<SteamModPreview>, String> {
    let response: SteamApiResponse = serde_json::from_str(body)
        .map_err(|error| format!("Could not parse the Steam response: {error}"))?;
    let Some(details) = response.response.published_file_details.into_iter().next() else {
        return Ok(None);
    };
    if details.result != 1 || details.published_file_id != requested_id {
        return Ok(None);
    }

    Ok(Some(SteamModPreview {
        published_file_id: details.published_file_id,
        title: details.title,
        description: details.description,
        preview_url: details.preview_url,
        time_updated: details.time_updated,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_steam_workshop_preview_fields() {
        let response = r#"{"response":{"publishedfiledetails":[{"publishedfileid":"12345","result":1,"title":"A mod","description":"Workshop description","preview_url":"https://images.steamusercontent.com/preview.jpg","time_updated":1700000000}]}}"#;

        let preview = parse_steam_response(response, "12345")
            .expect("Steam response should parse")
            .expect("published item should be returned");

        assert_eq!(preview.title, "A mod");
        assert_eq!(preview.description, "Workshop description");
        assert_eq!(
            preview.preview_url.as_deref(),
            Some("https://images.steamusercontent.com/preview.jpg")
        );
        assert_eq!(preview.time_updated, Some(1700000000));
    }

    #[test]
    fn ignores_missing_or_mismatched_workshop_items() {
        let missing = r#"{"response":{"publishedfiledetails":[]}}"#;
        let unpublished =
            r#"{"response":{"publishedfiledetails":[{"publishedfileid":"12345","result":9}]}}"#;
        let mismatched =
            r#"{"response":{"publishedfiledetails":[{"publishedfileid":"54321","result":1}]}}"#;

        assert_eq!(parse_steam_response(missing, "12345"), Ok(None));
        assert_eq!(parse_steam_response(unpublished, "12345"), Ok(None));
        assert_eq!(parse_steam_response(mismatched, "12345"), Ok(None));
    }

    #[test]
    fn rejects_non_numeric_workshop_ids() {
        assert!(!valid_published_file_id(""));
        assert!(!valid_published_file_id("abc"));
        assert!(!valid_published_file_id("0"));
        assert!(valid_published_file_id("12345"));
    }

    #[tokio::test]
    async fn posts_requested_workshop_id_and_parses_response() {
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
            assert!(request.contains("itemcount=1"));
            assert!(request.contains("publishedfileids%5B0%5D=12345"));
            let body = r#"{"response":{"publishedfiledetails":[{"publishedfileid":"12345","result":1,"title":"Steam title"}]}}"#;
            let response = format!(
				"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
				body.len()
			);
            stream
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
        });

        let preview = request_steam_mod_details(&format!("http://{address}/details"), "12345")
            .await
            .expect("Steam details request should succeed");

        assert_eq!(
            preview.map(|item| item.title),
            Some("Steam title".to_string())
        );
        server.await.expect("mock Steam server should complete");
    }
}
