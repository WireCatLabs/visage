//! `cargo test --lib -- --ignored --nocapture page_loads`: replays each page's native calls the way the interface
//! fires them, on a first visit and on a revisit in the same app session. Prints processes started and milliseconds,
//! never names, paths or values.

use crate::catalog::Tool;
use crate::{archive, compat, paths, run, runs, settings, skills, storage, system, tasks, tools};
use std::time::Instant;

type Job<'a> = Box<dyn FnOnce() + Send + 'a>;

/// Runs the jobs at once, like the interface's `Promise.all`, and returns each one's finish time in ms.
fn together(jobs: Vec<Job<'_>>) -> Vec<u128> {
    let started = Instant::now();
    std::thread::scope(|s| {
        let handles: Vec<_> = jobs
            .into_iter()
            .map(|job| {
                s.spawn(move || {
                    job();
                    started.elapsed().as_millis()
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    })
}

fn installed() -> Vec<&'static Tool> {
    tools::owners().filter(|t| paths::find(&t.bin).is_some()).collect()
}

fn report(page: &str, visit: &str, data_ms: u128, before: usize, started: Instant) {
    println!(
        "{page:<8} {visit:<8} data {data_ms:>5} ms   all done {:>5} ms   processes {:>3}",
        started.elapsed().as_millis(),
        run::started() - before
    );
}

/// The interface checks Node.js and npm again only on the first visit and on "Check again".
fn tools_page(visit: &str) {
    let fresh = visit == "check";
    let (before, started) = (run::started(), Instant::now());
    let mut jobs: Vec<Job<'static>> =
        vec![Box::new(move || drop(tools::detect_all(fresh))), Box::new(move || drop(tools::latest_versions(fresh)))];
    if visit != "revisit" {
        jobs.push(Box::new(|| drop(system::readiness())));
    }
    let done = together(jobs);
    report("Tools", visit, done[0].max(done.get(2).copied().unwrap_or(0)), before, started);
}

fn storage_page(visit: &str) {
    let (before, started) = (run::started(), Instant::now());
    let done = together(vec![
        Box::new(|| drop(storage::report())),
        Box::new(|| drop(archive::info())),
        Box::new(|| drop(archive::tables(false))),
        Box::new(|| drop(compat::compat())),
    ]);
    report("Storage", visit, done.into_iter().max().unwrap_or(0), before, started);
}

fn logs_jobs() -> Vec<Job<'static>> {
    let mut jobs: Vec<Job<'static>> = Vec::new();
    for t in installed().into_iter().filter(|t| t.runs.is_some()) {
        jobs.push(Box::new(move || drop(runs::list(t, None, 500, 1))));
        if t.settings.as_ref().is_some_and(|s| s.defaults) {
            jobs.push(Box::new(move || drop(settings::show(t, None))));
        }
    }
    jobs
}

fn logs_page(visit: &str) {
    let (before, started) = (run::started(), Instant::now());
    let done = together(logs_jobs());
    report("Logs", visit, done.into_iter().max().unwrap_or(0), before, started);
}

/// The defaults of the first installed tool with per-profile settings, which is where Config opens by default. The
/// profile list only checks a remembered profile, so the defaults are asked for alongside it.
fn config_page(visit: &str) {
    let Some(tool) = installed().into_iter().find(|t| t.settings.as_ref().is_some_and(|s| s.per_profile)) else {
        return;
    };
    let (before, started) = (run::started(), Instant::now());
    let done = together(vec![Box::new(|| drop(tools::profiles(tool))), Box::new(|| drop(settings::show(tool, None)))]);
    report("Config", visit, done[1], before, started);
}

/// The skills table first; the run logs, profiles and task claims once it has answered.
fn agents_page(visit: &str) {
    let (before, started) = (run::started(), Instant::now());
    let mut first: Vec<Job<'static>> = vec![Box::new(|| drop(skills::agents()))];
    for t in installed().into_iter().filter(|t| t.skill.is_some()) {
        first.push(Box::new(move || drop(skills::status(t))));
    }
    let skills_ms = together(first).into_iter().max().unwrap_or(0);
    let mut jobs = logs_jobs();
    for t in installed().into_iter().filter(|t| t.profiles.is_some()) {
        jobs.push(Box::new(move || {
            let names: Vec<String> =
                tools::profiles(t).ok().flatten().unwrap_or_default().into_iter().map(|p| p.name).collect();
            if t.tasks.is_some() {
                std::thread::scope(|s| {
                    for p in &names {
                        s.spawn(move || drop(tasks::claims(t, p)));
                    }
                });
            }
        }));
    }
    together(jobs);
    report("Agents", visit, skills_ms, before, started);
}

#[test]
#[ignore = "runs the installed tools; prints timings"]
fn page_loads() {
    let started = Instant::now();
    let _ = paths::search_path();
    println!("login shell PATH and node checks: {} ms", started.elapsed().as_millis());
    let pages: [fn(&str); 5] = [tools_page, storage_page, logs_page, config_page, agents_page];
    for page in pages {
        page("first");
        page("revisit");
    }
    tools_page("check");
}
