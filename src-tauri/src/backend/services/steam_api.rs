use std::time::Duration;

use serde_json::Value;

#[cfg(windows)]
const STEAM_API_LIST_URL: &str =
    "https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/";
#[cfg(windows)]
const CREDENTIAL_SERVICE: &str = "fast-rimworld-manager";
#[cfg(windows)]
const CREDENTIAL_USER: &str = "steam-web-api-key";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

pub(crate) fn save_steam_api_key(api_key: String) -> Result<(), String> {
    let api_key = validate_steam_api_key(&api_key)?;

    #[cfg(windows)]
    {
        credential_entry()?.set_password(&api_key).map_err(|_| {
            "Could not save the Steam API key to Windows Credential Manager.".to_string()
        })
    }
    #[cfg(not(windows))]
    {
        let _ = api_key;
        Err("Secure Steam API key storage is currently available only on Windows.".to_string())
    }
}

pub(crate) fn remove_steam_api_key() -> Result<(), String> {
    #[cfg(windows)]
    {
        match credential_entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(
                "Could not remove the Steam API key from Windows Credential Manager.".to_string(),
            ),
        }
    }
    #[cfg(not(windows))]
    {
        Err("Secure Steam API key storage is currently available only on Windows.".to_string())
    }
}

pub(crate) fn steam_api_key_configured() -> Result<bool, String> {
    #[cfg(windows)]
    {
        match credential_entry()?.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(_) => {
                Err("Could not read the Steam API key from Windows Credential Manager.".to_string())
            }
        }
    }
    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

pub(crate) async fn test_steam_api_connection() -> Result<(), String> {
    #[cfg(windows)]
    {
        let api_key = credential_entry()?
            .get_password()
            .map_err(|error| match error {
                keyring::Error::NoEntry => {
                    "Save a Steam Web API key before testing the connection.".to_string()
                }
                _ => {
                    "Could not read the Steam API key from Windows Credential Manager.".to_string()
                }
            })?;
        request_supported_api_list(STEAM_API_LIST_URL, &api_key).await
    }
    #[cfg(not(windows))]
    {
        Err("Steam Web API integration is currently available only on Windows.".to_string())
    }
}

fn validate_steam_api_key(api_key: &str) -> Result<&str, String> {
    let api_key = api_key.trim();
    if api_key.len() != 32 || !api_key.is_ascii() {
        return Err("A Steam Web API key must contain 32 ASCII characters.".to_string());
    }
    Ok(api_key)
}

#[cfg(windows)]
fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER)
        .map_err(|_| "Windows Credential Manager is unavailable.".to_string())
}

async fn request_supported_api_list(endpoint: &str, api_key: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "Could not initialize the Steam Web API client.".to_string())?;
    let response = client
        .get(endpoint)
        .query(&[("key", api_key)])
        .send()
        .await
        .map_err(|_| "Could not reach the Steam Web API.".to_string())?;
    let response = response
        .error_for_status()
        .map_err(|_| "Steam rejected the Web API request. Verify the saved key.".to_string())?;
    let body = response
        .text()
        .await
        .map_err(|_| "Could not read the Steam Web API response.".to_string())?;
    let response: Value = serde_json::from_str(&body)
        .map_err(|_| "Steam returned an invalid Web API response.".to_string())?;
    if !has_authenticated_method(&response) {
        return Err("Steam did not accept the saved Web API key.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_32_character_api_keys() {
        let key = "0123456789abcdef0123456789abcdef";
        assert_eq!(validate_steam_api_key(key), Ok(key));
    }

    #[test]
    fn rejects_api_keys_with_the_wrong_length() {
        assert!(validate_steam_api_key("short").is_err());
        assert!(validate_steam_api_key("0123456789abcdef0123456789abcdef0").is_err());
    }

    #[test]
    fn rejects_api_lists_without_a_key_restricted_method() {
        let response = r#"{"apilist":{"interfaces":[{"name":"ISteamWebAPIUtil","methods":[{"name":"GetServerInfo"}]}]}}"#;
        let parsed: Value = serde_json::from_str(response).expect("fixture JSON should parse");
        assert!(!has_authenticated_method(&parsed));
    }

    #[tokio::test]
    async fn sends_api_key_and_accepts_restricted_api_list() {
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
            let mut chunk = [0; 1024];
            let read = stream.read(&mut chunk).await.expect("request should read");
            request.extend_from_slice(&chunk[..read]);
            let request = String::from_utf8(request).expect("request should be UTF-8");
            assert!(
                request.starts_with("GET /supported?key=0123456789abcdef0123456789abcdef HTTP/1.1")
            );
            let body = r#"{"apilist":{"interfaces":[{"name":"IPlayerService","methods":[{"name":"GetBadges"}]}]}}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
        });

        let result = request_supported_api_list(
            &format!("http://{address}/supported"),
            "0123456789abcdef0123456789abcdef",
        )
        .await;

        assert!(result.is_ok(), "Steam API check failed: {result:?}");
        server.await.expect("server should complete");
    }

    #[tokio::test]
    async fn connection_errors_never_include_the_api_key() {
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
            let mut request = [0; 1024];
            stream
                .read(&mut request)
                .await
                .expect("request should be read");
            let body = "{}";
            let response = format!(
                "HTTP/1.1 403 Forbidden\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
        });

        let key = "0123456789abcdef0123456789abcdef";
        let error = request_supported_api_list(&format!("http://{address}/supported"), key)
            .await
            .expect_err("HTTP errors should be reported");

        assert_eq!(
            error,
            "Steam rejected the Web API request. Verify the saved key."
        );
        assert!(!error.contains(key));
        server.await.expect("server should complete");
    }
}

fn has_authenticated_method(response: &Value) -> bool {
    response
        .get("apilist")
        .and_then(|api_list| api_list.get("interfaces"))
        .and_then(Value::as_array)
        .is_some_and(|interfaces| {
            interfaces.iter().any(|interface| {
                interface.get("name").and_then(Value::as_str) == Some("IPlayerService")
                    && interface
                        .get("methods")
                        .and_then(Value::as_array)
                        .is_some_and(|methods| {
                            methods.iter().any(|method| {
                                method.get("name").and_then(Value::as_str) == Some("GetBadges")
                            })
                        })
            })
        })
}
