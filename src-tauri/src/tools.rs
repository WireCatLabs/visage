use crate::cache::Stamp;
use crate::catalog::{self, Tool};
use crate::{paths, redact, run};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Install {
    pub path: String,
    pub version: Option<String>,
    pub manager: &'static str,
    pub problem: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolState {
    pub id: String,
    /// In PATH order: the first one is what a terminal runs; the rest are shadowed copies.
    pub installs: Vec<Install>,
}

/// A part reports its owner's copies: it is the same program.
/// `fresh` runs every copy's `--version` again; otherwise a copy whose program file is unchanged keeps its answer.
pub fn detect_all(fresh: bool) -> Vec<ToolState> {
    let owners = detect_owners(fresh);
    catalog::catalog()
        .tools
        .iter()
        .map(|t| {
            let owner = catalog::owner(t);
            let installs = owners.iter().find(|o| o.id == owner.id).map(|o| o.installs.clone()).unwrap_or_default();
            ToolState { id: t.id.clone(), installs }
        })
        .collect()
}

/// Tools that own their package; a part never runs a command of its own to install or detect.
pub fn owners() -> impl Iterator<Item = &'static Tool> {
    catalog::catalog().tools.iter().filter(|t| t.part_of.is_none())
}

/// One state per package, for what must not count a shared package twice: storage and bug reports.
pub fn detect_owners(fresh: bool) -> Vec<ToolState> {
    std::thread::scope(|s| {
        let handles: Vec<_> = owners().map(|t| s.spawn(move || detect(t, fresh))).collect();
        handles.into_iter().map(|h| h.join().expect("detect thread")).collect()
    })
}

/// Whether any copy is on PATH, which is what "installed" means in `detect`, found without starting the tool.
pub fn installed(tool: &Tool) -> bool {
    !paths::find_all(&tool.bin).is_empty()
}

pub fn detect(tool: &Tool, fresh: bool) -> ToolState {
    let installs = std::thread::scope(|s| {
        let handles: Vec<_> =
            paths::find_all(&tool.bin).into_iter().map(|p| s.spawn(move || VERSIONS.inspect(&p, fresh))).collect();
        handles.into_iter().map(|h| h.join().expect("inspect thread")).collect()
    });
    ToolState { id: tool.id.clone(), installs }
}

/// A working copy's `--version`, kept while its program file is unchanged. It is still asked again after a while:
/// a broken dependency or a Node.js switch changes no file of the tool's own.
struct Versions(Mutex<HashMap<PathBuf, (Stamp, Instant, Install)>>);

const VERSION_KEPT: Duration = Duration::from_mins(10);

static VERSIONS: LazyLock<Versions> = LazyLock::new(|| Versions(Mutex::new(HashMap::new())));

impl Versions {
    fn inspect(&self, path: &Path, fresh: bool) -> Install {
        self.answer(path, fresh, VERSION_KEPT, inspect)
    }

    fn answer(&self, path: &Path, fresh: bool, kept: Duration, ask: impl FnOnce(&Path) -> Install) -> Install {
        let stamp = Stamp::of(path);
        if !fresh
            && let Some(now) = &stamp
            && let Some((known, at, install)) = self.0.lock().unwrap().get(path)
            && known == now
            && at.elapsed() < kept
        {
            return install.clone();
        }
        let install = ask(path);
        let mut map = self.0.lock().unwrap();
        match stamp {
            // Only a working answer is kept, so a start that timed out on a busy machine is asked again next time.
            Some(stamp) if install.problem.is_none() => {
                map.insert(path.to_path_buf(), (stamp, Instant::now(), install.clone()));
            }
            _ => {
                map.remove(path);
            }
        }
        install
    }
}

fn inspect(path: &Path) -> Install {
    let shown = paths::tilde(&path.to_string_lossy());
    let manager = paths::manager_for(path);
    match run::run(path, &["--version"], Some(&paths::search_path()), Duration::from_secs(20)) {
        Ok(o) if o.code == Some(0) => Install {
            path: shown,
            version: o.stdout.lines().next().map(|l| l.trim().trim_start_matches('v').to_string()),
            manager,
            problem: None,
        },
        Ok(o) => Install { path: shown, version: None, manager, problem: Some(redact::text(last_line(&o.stderr))) },
        Err(e) => Install { path: shown, version: None, manager, problem: Some(e.to_string()) },
    }
}

/// The registry's latest version of one package, via the user's npm so registry and proxy settings apply.
pub fn latest_version(package: &str) -> Option<String> {
    let npm = paths::find("npm")?;
    run::run(&npm, &["view", package, "version"], Some(&paths::search_path()), Duration::from_secs(20))
        .ok()
        .filter(|o| o.code == Some(0))
        .map(|o| o.stdout.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Releases come a few times a day at most, and `npm view` is the slowest call on the Tools page.
const LATEST_KEPT: Duration = Duration::from_hours(1);

static LATEST: LazyLock<Mutex<HashMap<String, (Instant, String)>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Only an answer is kept: npm offline at launch must not hide updates for an hour.
fn latest_kept(package: &str, fresh: bool, ask: impl FnOnce(&str) -> Option<String>) -> Option<String> {
    if !fresh
        && let Some((at, version)) = LATEST.lock().unwrap().get(package)
        && at.elapsed() < LATEST_KEPT
    {
        return Some(version.clone());
    }
    let found = ask(package)?;
    LATEST.lock().unwrap().insert(package.to_string(), (Instant::now(), found.clone()));
    Some(found)
}

/// Latest published versions of every tool's package; `fresh` asks npm even when an answer is kept.
pub fn latest_versions(fresh: bool) -> Vec<(String, Option<String>)> {
    if paths::find("npm").is_none() {
        return catalog::catalog().tools.iter().map(|t| (t.id.clone(), None)).collect();
    }
    let found: Vec<(String, Option<String>)> = std::thread::scope(|s| {
        let handles: Vec<_> =
            owners().map(|t| s.spawn(move || (t.id.clone(), latest_kept(&t.package, fresh, latest_version)))).collect();
        handles.into_iter().map(|h| h.join().expect("npm view thread")).collect()
    });
    catalog::catalog()
        .tools
        .iter()
        .map(|t| {
            let owner = catalog::owner(t);
            (t.id.clone(), found.iter().find(|(id, _)| *id == owner.id).and_then(|(_, v)| v.clone()))
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    /// What the tool remembers locally; None when the tool does not say.
    pub signed_in: Option<bool>,
}

pub fn profiles(tool: &Tool) -> Result<Option<Vec<Profile>>, String> {
    let Some(src) = &tool.profiles else { return Ok(None) };
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let args: Vec<&str> = src.args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &args, Some(&paths::search_path()), Duration::from_secs(30)).map_err(|e| e.to_string())?;
    let value = out.json().ok_or_else(|| redact::text(last_line(&out.stderr)))?;
    Ok(Some(parse_profiles(&value, &src.shape)))
}

fn parse_profiles(v: &Value, shape: &str) -> Vec<Profile> {
    let list = match shape {
        "items" => &v["items"],
        "item.profiles" => &v["item"]["profiles"],
        "item.items" => &v["item"]["items"],
        "item.mail.accounts" => &v["item"]["mail"]["accounts"],
        _ => &Value::Null,
    };
    // A missing-profile error lists the profiles too; tools that fail that way still tell us.
    let list = if list.is_array() { list } else { &v["error"]["details"]["profiles"] };
    list.as_array()
        .into_iter()
        .flatten()
        .filter_map(|p| match p {
            Value::String(name) => Some(Profile { name: name.clone(), signed_in: None }),
            Value::Object(o) => Some(Profile {
                // memo's mail accounts carry `name`, beside an address that must stay in Rust.
                name: o.get("profile").or_else(|| o.get("name"))?.as_str()?.to_string(),
                // cli-core 0.466 says it outright; older tools only leave `account` empty.
                signed_in: o
                    .get("signed_in")
                    .and_then(Value::as_bool)
                    .or_else(|| o.get("account").map(|a| !a.is_null())),
            }),
            _ => None,
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnosis {
    pub command: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
    /// The tool's own JSON with identifiers masked; None when it printed none.
    pub report: Option<Value>,
    pub stderr: String,
}

pub fn diagnose(tool: &Tool, profile: Option<&str>) -> Result<Diagnosis, String> {
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let args = catalog::with_profile(&tool.doctor, profile)?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let started = Instant::now();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_secs(90)).map_err(|e| e.to_string())?;
    let mut report = out.json();
    if let Some(r) = report.as_mut() {
        redact::json(r);
    }
    Ok(Diagnosis {
        command: format!("{} {}", tool.bin, args.join(" ")),
        exit_code: out.code,
        duration_ms: started.elapsed().as_millis(),
        report,
        stderr: redact::text(out.stderr.trim()),
    })
}

fn last_line(s: &str) -> &str {
    s.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("").trim()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::tests::TempProgram;
    use serde_json::json;
    use std::cell::Cell;

    fn working(version: &str) -> Install {
        Install { path: "~/bin/zm".into(), version: Some(version.into()), manager: "npm", problem: None }
    }

    #[test]
    fn a_changed_program_is_asked_again_and_an_unchanged_one_is_not() {
        let p = TempProgram::new("versions");
        let versions = Versions(Mutex::new(HashMap::new()));
        let asked = Cell::new(0);
        let ask = |v: &'static str| {
            let asked = &asked;
            move |_: &Path| {
                asked.set(asked.get() + 1);
                working(v)
            }
        };
        let kept = Duration::from_mins(10);
        assert_eq!(versions.answer(&p.0, false, kept, ask("1.0.0")).version.as_deref(), Some("1.0.0"));
        assert_eq!(versions.answer(&p.0, false, kept, ask("never")).version.as_deref(), Some("1.0.0"));
        assert_eq!(asked.get(), 1);

        p.update("2.0.0");
        assert_eq!(versions.answer(&p.0, false, kept, ask("2.0.0")).version.as_deref(), Some("2.0.0"));
        assert_eq!(asked.get(), 2);

        // Check again over an unchanged file whose dependency broke.
        let broken = |_: &Path| Install { problem: Some("Cannot find module".into()), version: None, ..working("") };
        assert!(versions.answer(&p.0, true, kept, broken).problem.is_some());
        assert_eq!(versions.answer(&p.0, false, kept, ask("2.0.0")).version.as_deref(), Some("2.0.0"));
        assert_eq!(asked.get(), 3, "a problem is never kept");

        assert_eq!(versions.answer(&p.0, false, Duration::ZERO, ask("2.0.1")).version.as_deref(), Some("2.0.1"));
    }

    #[test]
    fn npm_answers_are_kept_and_its_silence_is_not() {
        let package = "@wirecat/kept-test";
        assert_eq!(latest_kept(package, false, |_| None), None);
        assert_eq!(latest_kept(package, false, |_| Some("1.0.0".into())).as_deref(), Some("1.0.0"));
        assert_eq!(latest_kept(package, false, |_| panic!("asked twice")).as_deref(), Some("1.0.0"));
        assert_eq!(latest_kept(package, true, |_| Some("1.1.0".into())).as_deref(), Some("1.1.0"));
    }

    #[test]
    fn profiles_from_each_shape() {
        let tg = json!({"items": [{"profile": "personal", "account": "x"}, {"profile": "bot", "account": null}]});
        let p = parse_profiles(&tg, "items");
        assert_eq!((p[0].name.as_str(), p[0].signed_in), ("personal", Some(true)));
        assert_eq!(p[1].signed_in, Some(false));

        let zm = json!({"item": {"profiles": ["personal"]}});
        assert_eq!(parse_profiles(&zm, "item.profiles")[0].name, "personal");

        let drive = json!({"item": {"items": [{"profile": "work"}]}});
        assert_eq!(parse_profiles(&drive, "item.items")[0].signed_in, None);

        let memo = json!({"item": {"mail": {"accounts": [{"name": "work", "address": "a@b.c", "mode": "gmail"}]}}});
        let mail = parse_profiles(&memo, "item.mail.accounts");
        assert_eq!((mail[0].name.as_str(), mail[0].signed_in), ("work", None));

        let err = json!({"error": {"details": {"profiles": ["a", "b"]}}});
        assert_eq!(parse_profiles(&err, "items").len(), 2);
    }
}
