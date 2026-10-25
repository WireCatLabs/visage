mod catalog;
mod install;
mod paths;
mod redact;
mod run;
mod system;
mod terminal;
mod tools;

use install::{InstallEvent, Running};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tauri::ipc::Channel;

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn readiness() -> Result<system::Readiness, String> {
    blocking(system::readiness).await
}

#[tauri::command]
async fn detect_tools() -> Result<Vec<tools::ToolState>, String> {
    blocking(tools::detect_all).await
}

#[tauri::command]
async fn latest_versions() -> Result<HashMap<String, Option<String>>, String> {
    blocking(|| tools::latest_versions().into_iter().collect()).await
}

#[tauri::command]
async fn list_profiles(id: String) -> Result<Option<Vec<tools::Profile>>, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tools::profiles(tool)).await?
}

#[tauri::command]
async fn diagnose(id: String, profile: Option<String>) -> Result<tools::Diagnosis, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tools::diagnose(tool, profile.as_deref())).await?
}

#[tauri::command]
async fn install_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    let running = Arc::clone(&running);
    blocking(move || install::install(tool, &running, &on_event)).await
}

#[tauri::command]
fn cancel_install(id: String, running: State<'_, Arc<Running>>) {
    running.cancel(&id);
}

#[tauri::command]
fn open_setup(id: String, profile: Option<String>) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    let args = tool.setup.as_ref().ok_or("this tool has no setup flow")?;
    let args = catalog::with_profile(args, profile.as_deref())?;
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    terminal::open(&bin, &args)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Running::default()))
        .invoke_handler(tauri::generate_handler![
            readiness,
            detect_tools,
            latest_versions,
            list_profiles,
            diagnose,
            install_tool,
            cancel_install,
            open_setup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
