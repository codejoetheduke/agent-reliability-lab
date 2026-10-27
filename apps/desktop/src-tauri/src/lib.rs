//! Native lifecycle for the bundled, per-user Python backend.
//!
//! Only a short-lived loopback nonce crosses IPC. Provider credentials are
//! loaded by Python and are never serialized by this native module.

use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    sync::Mutex,
    time::Duration,
};
use tauri::{Manager, State};
use tauri_plugin_shell::{ShellExt, process::CommandChild};

#[derive(Clone, serde::Serialize)]
struct SessionInfo {
    token: String,
    api_url: String,
    #[serde(skip)]
    port: u16,
}

struct Backend {
    session: SessionInfo,
    child: Mutex<Option<CommandChild>>,
}

fn start_backend(app: &tauri::AppHandle) -> Result<Backend, Box<dyn std::error::Error>> {
    // Source development uses the supervisor. Installed builds own their child.
    if let Ok(token) = std::env::var("LAB_SESSION_TOKEN") {
        if token.len() < 32 {
            return Err("Invalid supervised session token".into());
        }
        return Ok(Backend {
            session: SessionInfo {
                token,
                api_url: "http://127.0.0.1:8765".into(),
                port: 8765,
            },
            child: Mutex::new(None),
        });
    }
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "Cannot generate a local session nonce")?;
    let token: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    // The protected readiness probe detects an unexpected service in the bind gap.
    drop(listener);
    let (mut receiver, child) = app
        .shell()
        .sidecar("reliability-backend")?
        .env("LAB_SESSION_TOKEN", &token)
        .env("LAB_PORT", port.to_string())
        .env("LAB_DATA_DIR", &data_dir)
        .env("LAB_PARENT_MANAGED", "1")
        .spawn()?;
    tauri::async_runtime::spawn(async move {
        // Drain pipes, but never forward service output or request values to React.
        while receiver.recv().await.is_some() {}
    });
    Ok(Backend {
        session: SessionInfo {
            token,
            api_url: format!("http://127.0.0.1:{port}"),
            port,
        },
        child: Mutex::new(Some(child)),
    })
}

fn authorized_ready(session: &SessionInfo) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], session.port));
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(250)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    let request = format!(
        "GET /session HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Lab-Token: {}\r\nConnection: close\r\n\r\n",
        session.token
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut bytes = Vec::new();
    if stream.take(8192).read_to_end(&mut bytes).is_err() {
        return false;
    }
    let response = String::from_utf8_lossy(&bytes);
    response.starts_with("HTTP/1.1 200") && response.contains("agent-reliability-lab")
}

#[tauri::command]
async fn session_info(backend: State<'_, Backend>) -> Result<SessionInfo, String> {
    let session = backend.session.clone();
    tauri::async_runtime::spawn_blocking(move || {
        for _ in 0..120 {
            if authorized_ready(&session) {
                return Ok(session);
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err("The bundled local service could not start. Restart the application.".into())
    })
    .await
    .map_err(|_| "Local service readiness failed.".to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(start_backend(app.handle())?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![session_info])
        .build(tauri::generate_context!())
        .expect("Unable to initialize Agent Reliability Lab");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event
            && let Some(child) = handle
                .state::<Backend>()
                .child
                .lock()
                .ok()
                .and_then(|mut c| c.take())
        {
            let _ = child.kill();
        }
    });
}
