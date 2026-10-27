#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![session_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
#[tauri::command]
fn session_token() -> Result<String, String> {
    std::env::var("LAB_SESSION_TOKEN")
        .map_err(|_| "Launch the application through its supervised startup command.".to_string())
}

