mod archive;
mod backup;
mod cache;
mod catalog;
mod chats;
mod cloudflare;
mod cloudflare_install;
mod compat;
mod install;
mod mcp;
mod mcp_server;
mod node;
#[cfg(test)]
mod page_loads;
mod paths;
mod permissions;
mod profile;
mod public_address;
mod redact;
mod report;
mod run;
mod runs;
mod settings;
mod signin;
mod signin_steps;
mod skills;
mod storage;
mod sync;
mod system;
mod tailscale;
mod tailscale_install;
mod tailscale_linux;
mod tasks;
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
async fn detect_tools(fresh: bool) -> Result<Vec<tools::ToolState>, String> {
    blocking(move || tools::detect_all(fresh)).await
}

#[tauri::command]
async fn latest_versions(fresh: bool) -> Result<HashMap<String, Option<String>>, String> {
    blocking(move || tools::latest_versions(fresh).into_iter().collect()).await
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
    let done = blocking(move || install::install(tool, &running, &on_event)).await;
    compat::forget();
    done
}

#[tauri::command]
async fn uninstall_tool(
    id: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<InstallEvent>,
) -> Result<(), String> {
    let tool = catalog::owner(catalog::tool(&id)?);
    let running = Arc::clone(&running);
    let done = blocking(move || install::uninstall(tool, &running, &on_event)).await;
    compat::forget();
    done
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
async fn store_compat() -> Result<compat::StoreCompat, String> {
    blocking(compat::compat).await
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
async fn store_backup(
    running: State<'_, Arc<Running>>,
    password: Option<String>,
    on_event: Channel<backup::BackupEvent>,
) -> Result<(), String> {
    let running = Arc::clone(&running);
    let password = password.map(backup::Password::new);
    blocking(move || {
        let send = |e: backup::BackupEvent| {
            let _ = on_event.send(e);
        };
        if running.is_running(backup::RESET) || !running.start(backup::BACKUP) {
            return send(backup::BackupEvent::Failed { message: "A backup or a clear is already running.".into() });
        }
        backup::backup(password.as_ref(), &|| !running.is_running(backup::BACKUP), &send);
        running.finish(backup::BACKUP);
    })
    .await
}

#[tauri::command]
fn cancel_store_backup(running: State<'_, Arc<Running>>) {
    running.cancel(backup::BACKUP);
}

#[tauri::command]
async fn list_backups() -> Result<backup::Backups, String> {
    blocking(backup::list).await?
}

#[tauri::command]
async fn open_backups(name: Option<String>) -> Result<(), String> {
    blocking(move || backup::open(name.as_deref())).await?
}

#[tauri::command]
async fn store_reset_preview() -> Result<Option<backup::ResetPreview>, String> {
    blocking(backup::reset_preview).await?
}

#[tauri::command]
async fn store_reset(running: State<'_, Arc<Running>>) -> Result<Option<u64>, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if running.is_running(backup::BACKUP) || !running.start(backup::RESET) {
            return Err("A backup or a clear is already running.".to_string());
        }
        let done = backup::reset();
        running.finish(backup::RESET);
        done
    })
    .await?
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
async fn skill_show(id: String) -> Result<skills::SkillText, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || skills::show(tool)).await?
}

/// Which installed tools a terminal finds on its own PATH, by tool id. For Hermes it is the `bash -l` its gateway
/// runs commands in, started from the gateway's own PATH; without a gateway service, a terminal's.
#[tauri::command]
async fn terminal_reach(agent: Option<String>) -> Result<HashMap<String, bool>, String> {
    blocking(move || {
        let gateway = if agent.as_deref() == Some("hermes") { chats::hermes_base_path() } else { None };
        let gateway = gateway.and_then(|base| paths::bash_login_path(&base));
        catalog::catalog()
            .tools
            .iter()
            .filter(|t| t.part_of.is_none() && paths::find(&t.bin).is_some())
            .map(|t| {
                let found = match &gateway {
                    Some(path) => paths::finds(&t.bin, path),
                    None => paths::in_terminal(&t.bin),
                };
                (t.id.clone(), found)
            })
            .collect()
    })
    .await
}

#[tauri::command]
async fn agent_chats(agent: String) -> Result<chats::Chats, String> {
    blocking(move || chats::read(&agent)).await?
}

#[tauri::command]
async fn mcp_registrations(agent: String) -> Result<mcp::Registrations, String> {
    blocking(move || mcp::registrations(&agent)).await?
}

#[tauri::command]
async fn mcp_check(id: String, profile: String) -> Result<mcp::Health, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp::check(tool, &profile)).await?
}

#[tauri::command]
async fn mcp_add(id: String, profile: String, agent: String, allow_writes: bool) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp::add(tool, &profile, &agent, allow_writes)).await?
}

/// `profile: None` removes the bare `<bin>` entry a person may have added by hand.
#[tauri::command]
async fn mcp_remove(id: String, profile: Option<String>, agent: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp::remove(tool, profile.as_deref(), &agent)).await?
}

/// `profile` is `None` only for a tool without profiles (memo); the catalog's words say whether one is needed.
#[tauri::command]
async fn tailscale_status() -> Result<tailscale::Status, String> {
    blocking(tailscale::status).await
}

#[tauri::command]
async fn tailscale_download(
    kind: String,
    running: State<'_, Arc<Running>>,
) -> Result<tailscale_install::Downloaded, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        let key = "tailscale-download";
        if !running.start(key) {
            return Err("The download is already running.".to_string());
        }
        let result = tailscale_install::download(&kind, &|| !running.is_running(key));
        running.finish(key);
        result
    })
    .await?
}

#[tauri::command]
fn tailscale_terminal(what: String) -> Result<(), String> {
    terminal::open_line(&tailscale::terminal_line(&what)?)
}

#[tauri::command]
async fn tailscale_login(
    running: State<'_, Arc<Running>>,
    on_event: Channel<tailscale::PageEvent>,
) -> Result<(), String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(tailscale::LOGIN) {
            return Err("The Tailscale login is already running.".to_string());
        }
        let result = tailscale::login(&|| !running.is_running(tailscale::LOGIN), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(tailscale::LOGIN);
        result
    })
    .await?
}

/// Stops a waiting login or Funnel approval; whatever the person already did in the browser stays done.
#[tauri::command]
fn tailscale_stop(running: State<'_, Arc<Running>>) {
    running.cancel(tailscale::LOGIN);
    running.cancel(tailscale::FUNNEL);
}

#[tauri::command]
async fn tailscale_funnel_open(
    id: String,
    port: u16,
    running: State<'_, Arc<Running>>,
    on_event: Channel<tailscale::PageEvent>,
) -> Result<String, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(tailscale::FUNNEL) {
            return Err("Tailscale Funnel is being set up for another server; wait for it to finish.".to_string());
        }
        let result = tailscale::funnel_open(&id, port, &|| !running.is_running(tailscale::FUNNEL), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(tailscale::FUNNEL);
        result
    })
    .await?
}

#[tauri::command]
async fn tailscale_funnel_close(id: String) -> Result<(), String> {
    blocking(move || tailscale::funnel_close(&id)).await?
}

#[tauri::command]
async fn tailscale_funnels() -> Result<Vec<tailscale::FunnelState>, String> {
    blocking(tailscale::funnels).await
}

#[tauri::command]
async fn cloudflare_status() -> Result<cloudflare::Status, String> {
    blocking(cloudflare::status).await
}

/// Downloads cloudflared's own release into the app's folder; its version comes back.
#[tauri::command]
async fn cloudflare_install(running: State<'_, Arc<Running>>) -> Result<String, String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(cloudflare::INSTALL) {
            return Err("The download is already running.".to_string());
        }
        let result = cloudflare::install(&|| !running.is_running(cloudflare::INSTALL));
        running.finish(cloudflare::INSTALL);
        result
    })
    .await?
}

#[tauri::command]
async fn cloudflare_login(
    running: State<'_, Arc<Running>>,
    on_event: Channel<cloudflare::PageEvent>,
) -> Result<(), String> {
    let running = Arc::clone(&running);
    blocking(move || {
        if !running.start(cloudflare::LOGIN) {
            return Err("The Cloudflare login is already running.".to_string());
        }
        let result = cloudflare::login(&|| !running.is_running(cloudflare::LOGIN), &|e| {
            let _ = on_event.send(e);
        });
        running.finish(cloudflare::LOGIN);
        result
    })
    .await?
}

/// Stops a waiting login or download; whatever the person already did in the browser stays done.
#[tauri::command]
fn cloudflare_stop(running: State<'_, Arc<Running>>) {
    running.cancel(cloudflare::LOGIN);
    running.cancel(cloudflare::INSTALL);
}

#[tauri::command]
async fn cloudflare_create(hostname: String) -> Result<String, String> {
    blocking(move || cloudflare::create(&hostname)).await?
}

#[tauri::command]
async fn cloudflare_tunnel_open(id: String, port: u16) -> Result<String, String> {
    blocking(move || cloudflare::open(&id, port)).await?
}

#[tauri::command]
async fn cloudflare_tunnel_close(id: String) -> Result<(), String> {
    blocking(move || cloudflare::close(&id)).await?
}

#[tauri::command]
async fn cloudflare_routes() -> Result<Vec<cloudflare::RouteState>, String> {
    blocking(cloudflare::routes).await
}

#[tauri::command]
async fn mcp_server_status(id: String) -> Result<mcp_server::ServerStatus, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::status(tool)).await?
}

#[tauri::command]
async fn mcp_server_start(id: String, port: u16, url: String) -> Result<mcp_server::ServerStatus, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::start(tool, port, &url)).await?
}

#[tauri::command]
async fn mcp_server_stop(id: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::stop(tool)).await?
}

#[tauri::command]
async fn mcp_server_revoke(id: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::revoke(tool)).await?
}

#[tauri::command]
async fn mcp_server_oauth(id: String) -> Result<mcp_server::OAuthSettings, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::oauth(tool)).await?
}

#[tauri::command]
async fn mcp_server_public(id: String) -> Result<public_address::PublicCheck, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::public(tool)).await?
}

#[tauri::command]
async fn mcp_server_config(id: String) -> Result<String, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || mcp_server::config(tool)).await?
}

#[tauri::command]
async fn task_claims(id: String, profile: String) -> Result<tasks::Claims, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tasks::claims(tool, &profile)).await?
}

#[tauri::command]
async fn task_release(id: String, profile: String, task: String) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    blocking(move || tasks::release(tool, &profile, &task)).await?
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

/// Signs a profile in inside the window with one of the catalog's `signIn.methods`.
#[tauri::command]
async fn sign_in(
    id: String,
    method: String,
    profile: String,
    running: State<'_, Arc<Running>>,
    on_event: Channel<signin::SignInEvent>,
) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    let args = signin::args(tool, &method, &profile)?;
    let running = Arc::clone(&running);
    blocking(move || {
        let send = |e: signin::SignInEvent| {
            let _ = on_event.send(e);
        };
        let key = signin::key(&tool.id);
        if !running.start(&key) {
            return send(signin::SignInEvent::Failed {
                message: format!("A {} sign-in is already running.", tool.name),
                code: None,
            });
        }
        signin::run(tool, &args, &|| !running.is_running(&key), &send);
        running.finish(&key);
    })
    .await
}

/// Hands the running sign-in the answer to its last `needs` step, on its stdin; the value is wiped after the write.
#[tauri::command]
fn sign_in_answer(id: String, value: String) -> Result<(), String> {
    let value = signin::Answer::new(value);
    signin::answer(&catalog::tool(&id)?.id, &value)
}

/// Asks the running sign-in to stop; `sign_in` answers `stopped`, or `done` when the tool kept what had come.
#[tauri::command]
fn sign_in_stop(id: String, running: State<'_, Arc<Running>>) -> Result<(), String> {
    running.cancel(&signin::key(&catalog::tool(&id)?.id));
    Ok(())
}

/// Runs the tool's own sync for the profile the owner chose; stages and the result arrive on the channel.
#[tauri::command]
async fn sync_run(
    id: String,
    profile: Option<String>,
    running: State<'_, Arc<Running>>,
    on_event: Channel<sync::SyncEvent>,
) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    let args = sync::args(tool, profile.as_deref())?;
    let running = Arc::clone(&running);
    blocking(move || {
        let send = |e: sync::SyncEvent| {
            let _ = on_event.send(e);
        };
        let key = sync::key(tool, profile.as_deref());
        let busy = running.is_running(&catalog::owner(tool).id);
        if busy || !running.start(&key) {
            return send(sync::SyncEvent::Failed {
                message: if busy {
                    format!("{} is being installed or updated. Sync when it is done.", tool.name)
                } else {
                    "This sync is already running.".into()
                },
                code: None,
                reason: Some("app.busy".into()),
            });
        }
        sync::run(tool, &args, &|| !running.is_running(&key), &send);
        running.finish(&key);
    })
    .await
}

/// Asks that profile's running sync to stop: SIGTERM to its process, then its group after a few seconds.
#[tauri::command]
fn sync_stop(id: String, profile: Option<String>, running: State<'_, Arc<Running>>) -> Result<(), String> {
    let tool = catalog::tool(&id)?;
    if let Some(p) = &profile {
        catalog::validate_profile(p)?;
    }
    running.cancel(&sync::key(tool, profile.as_deref()));
    Ok(())
}

#[tauri::command]
async fn sync_last(id: String, profile: Option<String>) -> Result<sync::LastSync, String> {
    let tool = catalog::tool(&id)?;
    blocking(move || sync::last(tool, profile.as_deref())).await?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The login shell's PATH takes about half a second; read it while the window opens, not on the first page.
    std::thread::spawn(paths::search_path);
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
            store_compat,
            store_tables,
            store_check,
            store_backup,
            cancel_store_backup,
            list_backups,
            open_backups,
            store_reset_preview,
            store_reset,
            detect_agents,
            skill_status,
            skill_install,
            skill_show,
            terminal_reach,
            agent_chats,
            mcp_registrations,
            mcp_check,
            mcp_add,
            mcp_remove,
            mcp_server_status,
            mcp_server_start,
            mcp_server_stop,
            mcp_server_revoke,
            mcp_server_config,
            mcp_server_oauth,
            mcp_server_public,
            tailscale_status,
            tailscale_download,
            tailscale_terminal,
            tailscale_login,
            tailscale_stop,
            tailscale_funnel_open,
            tailscale_funnel_close,
            tailscale_funnels,
            cloudflare_status,
            cloudflare_install,
            cloudflare_login,
            cloudflare_stop,
            cloudflare_create,
            cloudflare_tunnel_open,
            cloudflare_tunnel_close,
            cloudflare_routes,
            task_claims,
            task_release,
            report_context,
            send_report,
            list_runs,
            show_run,
            settings_show,
            settings_set,
            settings_unset,
            permissions_show,
            open_setup,
            sign_in,
            sign_in_answer,
            sign_in_stop,
            sync_run,
            sync_stop,
            sync_last
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
