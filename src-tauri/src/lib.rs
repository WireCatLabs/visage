mod archive;
mod catalog;
mod install;
mod node;
mod paths;
mod permissions;
mod profile;
mod redact;
mod report;
mod run;
mod runs;
mod settings;
mod skills;
mod storage;
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
async fn node_offer() -> Result<node::Offer, String> {
    blocking(node::offer).await?
}

#[tauri::command]
async fn setup_node(running: State<'_, Arc<Running>>, on_event: Channel<node::NodeEvent>) -> Result<(), String> {
    let running = Arc::clone(&running);
    blocking(move || {
        let send = |e: node::NodeEvent| {
            let _ = on_event.send(e);
        };
        if !running.start(node::OPERATION) {
            return send(node::NodeEvent::Failed {
                reason: install::Reason::Failed,
                message: "Node.js setup is already running.".into(),
                hint: None,
            });
        }
        let result = match node::root() {
            Some(root) => node::setup(&root, &send, &|| !running.is_running(node::OPERATION)),
            None => Err(node::Failure::no_home()),
        };
        running.finish(node::OPERATION);
        paths::refresh(&[]);
        send(match result {
            Ok(done) => node::NodeEvent::Done {
                version: done.version.to_string(),
                path: paths::tilde(&done.dir.to_string_lossy()),
            },
            Err(f) => f.into(),
        });
    })
    .await
}

#[tauri::command]
fn cancel_node_setup(running: State<'_, Arc<Running>>) {
    running.cancel(node::OPERATION);
}

#[tauri::command]
async fn remove_node() -> Result<(), String> {
    blocking(node::remove).await?
}

/// What "Add to PATH" would write and where, for the app's own Node.js.
#[tauri::command]
async fn node_path() -> Result<profile::PathPlan, String> {
    blocking(|| {
        let found = node::installed().ok_or("WireCat has not set up Node.js on this computer.")?;
        Ok(profile::plan(&node::bin_dir(&found.dir)))
    })
    .await?
}

#[tauri::command]
async fn set_node_path(add: bool) -> Result<profile::PathPlan, String> {
    blocking(move || {
        let found = node::installed().ok_or("WireCat has not set up Node.js on this computer.")?;
        let bin = node::bin_dir(&found.dir);
        if add { profile::add(&bin) } else { profile::remove(&bin) }
    })
    .await?
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
    let tool = catalog::owner(catalog::tool(&id)?);
    let running = Arc::clone(&running);
    blocking(move || install::install(tool, &running, &on_event)).await
}

#[tauri::command]
async fn uninstall_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), String> {
    let tool = catalog::owner(catalog::tool(&id)?);
    let running = Arc::clone(&running);
    blocking(move || install::uninstall(tool, &running, &on_event)).await
}

#[tauri::command]
async fn storage_report() -> Result<Vec<storage::Area>, String> {
    blocking(storage::report).await
}

#[tauri::command]
async fn clear_storage(id: String) -> Result<(), String> {
    blocking(move || storage::clear(&id)).await?
}

#[tauri::command]
async fn open_folder(id: String, kind: String, entry: Option<String>) -> Result<(), String> {
    blocking(move || storage::open(&id, &kind, entry.as_deref())).await?
}

#[tauri::command]
async fn store_info() -> Result<Option<archive::StoreInfo>, String> {
    blocking(archive::info).await?
}

#[tauri::command]
async fn store_tables(sizes: bool) -> Result<Option<archive::TableList>, String> {
    blocking(move || archive::tables(sizes)).await?
}

#[tauri::command]
async fn store_check() -> Result<Option<archive::Check>, String> {
    blocking(archive::check).await?
}

#[tauri::command]
async fn detect_agents() -> Result<Vec<skills::Agent>, String> {
    blocking(skills::agents).await
}

#[tauri::command]
async fn skill_status(id: String) -> Result<skills::SkillReport, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || skills::status(tool)).await?
}

#[tauri::command]
async fn skill_install(id: String, target: String) -> Result<Option<String>, String> {
    let tool = catalog::tool(&id)?;
    skills::validate_target(&target)?;
    blocking(move || skills::install(tool, &target)).await?
}

#[tauri::command]
async fn list_runs(id: String, query: Option<String>, limit: u32, page: u32) -> Result<serde_json::Value, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || runs::list(tool, query.as_deref(), limit, page)).await?
}

#[tauri::command]
async fn show_run(id: String, run: String) -> Result<serde_json::Value, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || runs::show(tool, &run)).await?
}

#[tauri::command]
async fn settings_show(id: String, profile: Option<String>) -> Result<settings::Settings, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || settings::show(tool, profile.as_deref())).await?
}

/// `profile: None` with `defaults` changes what every profile gets.
#[tauri::command]
async fn settings_set(
    id: String,
    profile: Option<String>,
    defaults: bool,
    setting: String,
    value: String,
) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || settings::set(tool, profile.as_deref(), defaults, &setting, &value)).await?
}

#[tauri::command]
async fn settings_unset(id: String, profile: Option<String>, defaults: bool, setting: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || settings::unset(tool, profile.as_deref(), defaults, &setting)).await?
}

/// Saving goes through `settings_set` / `settings_unset` with a `permissions.<key>` setting.
#[tauri::command]
async fn permissions_show(id: String, profile: Option<String>) -> Result<permissions::Permissions, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || permissions::show(tool, profile.as_deref())).await?
}

#[tauri::command]
async fn report_context() -> Result<report::Context, String> {
    blocking(report::context).await
}

#[tauri::command]
async fn send_report(draft: report::Draft, context: report::Context) -> Result<report::Sent, String> {
    blocking(move || report::send(draft, context)).await?
}

#[tauri::command]
fn cancel_install(id: String, running: State<'_, Arc<Running>>) {
    let id = catalog::tool(&id).map_or(id.clone(), |t| catalog::owner(t).id.clone());
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
            node_offer,
            setup_node,
            cancel_node_setup,
            remove_node,
            node_path,
            set_node_path,
            detect_tools,
            latest_versions,
            list_profiles,
            diagnose,
            install_tool,
            uninstall_tool,
            cancel_install,
            storage_report,
            clear_storage,
            open_folder,
            store_info,
            store_tables,
            store_check,
            detect_agents,
            skill_status,
            skill_install,
            report_context,
            send_report,
            list_runs,
            show_run,
            settings_show,
            settings_set,
            settings_unset,
            permissions_show,
            open_setup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
