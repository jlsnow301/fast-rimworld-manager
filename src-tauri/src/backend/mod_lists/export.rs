use std::fs;
use std::path::Path;

pub(crate) fn export_active_mod_list(
    path: String,
    active_mods: Vec<String>,
) -> Result<String, String> {
    let output_path = Path::new(&path);
    fs::write(output_path, active_mods.join("\n")).map_err(|error| {
        format!(
            "Could not export active mod list {}: {error}",
            output_path.display()
        )
    })?;
    Ok(output_path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_active_package_ids_in_load_order() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("active-mod-export-{nonce}"));
        fs::create_dir_all(&directory).expect("fixture directory should be created");
        let path = directory.join("active-mods.txt");
        let package_ids = vec![
            "ludeon.rimworld".to_string(),
            "brrainz.harmony".to_string(),
            "sample.vehiclemod".to_string(),
        ];

        export_active_mod_list(path.to_string_lossy().into_owned(), package_ids)
            .expect("active mod list should be exported");

        let contents = fs::read_to_string(&path).expect("exported file should be readable");
        assert_eq!(
            contents,
            "ludeon.rimworld\nbrrainz.harmony\nsample.vehiclemod"
        );
        fs::remove_dir_all(directory).expect("fixture directory should be removed");
    }
}
