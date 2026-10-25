use crate::catalog::{RunsSource, Tool};
use crate::{paths, redact, run};
use serde_json::Value;
use std::time::Duration;

pub const MAX_LIMIT: u32 = 1000;

fn source(tool: &Tool) -> Result<&RunsSource, String> {
    tool.runs.as_ref().ok_or_else(|| "This tool does not keep run logs yet.".into())
}

/// Run ids come back from the tool, but reach us through the interface, so only plain ids pass.
pub fn validate_run(run: &str) -> Result<(), String> {
    let ok = !run.is_empty()
        && run.len() <= 200
        && !run.starts_with('-')
        && run.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if ok { Ok(()) } else { Err(format!("not a valid run id: {run}")) }
}

/// The query travels as one argument; a leading '-' would turn it into a flag.
pub fn validate_query(query: &str) -> Result<(), String> {
    let ok = query.len() <= 500 && !query.trim_start().starts_with('-') && !query.chars().any(char::is_control);
    if ok { Ok(()) } else { Err("not a valid run query".into()) }
}

fn list_args(src: &RunsSource, query: Option<&str>, limit: u32, page: u32) -> Result<Vec<String>, String> {
    let query = query.map(str::trim).filter(|q| !q.is_empty());
    if let Some(q) = query {
        validate_query(q)?;
    }
    if !(1..=MAX_LIMIT).contains(&limit) || page == 0 {
        return Err(format!("limit must be 1 to {MAX_LIMIT} and page at least 1"));
    }
    Ok(src
        .list
        .iter()
        .filter_map(|a| match a.as_str() {
            "{query}" => query.map(str::to_string),
            "{limit}" => Some(limit.to_string()),
            "{page}" => Some(page.to_string()),
            _ => Some(a.clone()),
        })
        .collect())
}

fn show_args(src: &RunsSource, run: &str) -> Result<Vec<String>, String> {
    validate_run(run)?;
    Ok(src.show.iter().map(|a| if a == "{run}" { run.to_string() } else { a.clone() }).collect())
}

pub fn list(tool: &Tool, query: Option<&str>, limit: u32, page: u32) -> Result<Value, String> {
    let args = list_args(source(tool)?, query, limit, page)?;
    call(tool, &args)
}

pub fn show(tool: &Tool, run: &str) -> Result<Value, String> {
    let args = show_args(source(tool)?, run)?;
    call(tool, &args)
}

fn call(tool: &Tool, args: &[String]) -> Result<Value, String> {
    let bin = paths::find(&tool.bin).ok_or("the tool is not installed")?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run::run(&bin, &refs, Some(&paths::search_path()), Duration::from_secs(30)).map_err(|e| e.to_string())?;
    let mut value = first_json(&out.stdout).or_else(|| first_json(&out.stderr));
    if let Some(v) = value.as_mut() {
        redact::json(v);
    }
    match value {
        Some(v) if out.code == Some(0) => Ok(v),
        Some(v) => Err(v["error"]["message"].as_str().map_or_else(|| failure(&out), str::to_string)),
        None => Err(failure(&out)),
    }
}

// Notes the CLI prints for people may follow the JSON, so only the first value is read.
fn first_json(s: &str) -> Option<Value> {
    serde_json::Deserializer::from_str(s).into_iter::<Value>().next()?.ok()
}

fn failure(out: &run::Output) -> String {
    let text = if out.stderr.trim().is_empty() { &out.stdout } else { &out.stderr };
    let line = text.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("the tool gave no answer");
    redact::text(line.trim())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog;

    fn tg() -> &'static Tool {
        catalog::tool("tg").unwrap()
    }

    #[test]
    fn accepts_run_ids_the_cli_writes() {
        assert!(validate_run("20261025T124651Z-messages-send-f77521").is_ok());
        assert!(validate_run("--help").is_err());
        assert!(validate_run("a b").is_err());
        assert!(validate_run("../x").is_err());
        assert!(validate_run("").is_err());
    }

    #[test]
    fn query_is_one_argument_and_never_a_flag() {
        let src = source(tg()).unwrap();
        let args = list_args(src, Some("status:failed command:\"messages send\""), 500, 2).unwrap();
        assert_eq!(
            args,
            ["runs", "list", "status:failed command:\"messages send\"", "--limit", "500", "--page", "2", "--json"]
        );
        assert!(list_args(src, Some(" --record"), 10, 1).is_err());
        assert!(list_args(src, Some("a\nb"), 10, 1).is_err());
    }

    #[test]
    fn no_query_drops_the_slot_and_bounds_the_page() {
        let src = source(tg()).unwrap();
        assert_eq!(
            list_args(src, Some("  "), 20, 1).unwrap(),
            ["runs", "list", "--limit", "20", "--page", "1", "--json"]
        );
        assert!(list_args(src, None, 0, 1).is_err());
        assert!(list_args(src, None, MAX_LIMIT + 1, 1).is_err());
        assert!(list_args(src, None, 10, 0).is_err());
    }

    #[test]
    fn show_substitutes_a_valid_run() {
        let src = source(tg()).unwrap();
        assert_eq!(show_args(src, "run-1").unwrap(), ["runs", "show", "run-1", "--json"]);
        assert!(show_args(src, "-x").is_err());
        assert!(source(catalog::tool("memo").unwrap()).is_err());
    }

    #[test]
    fn reads_the_first_json_value_only() {
        assert_eq!(first_json("{\"items\":[]}\nnothing recorded").unwrap()["items"], serde_json::json!([]));
        assert!(first_json("not json").is_none());
    }

    /// `cargo test -- --ignored real_tg` against the installed tg; prints shapes and counts, never values.
    #[test]
    #[ignore = "needs tg installed"]
    fn real_tg() {
        let page = list(tg(), None, 50, 1).unwrap();
        let items = page["items"].as_array().unwrap();
        let mut keys: Vec<_> = items.iter().flat_map(|i| i.as_object().unwrap().keys().cloned()).collect();
        keys.sort();
        keys.dedup();
        println!("list: {} items, has_more={}, keys={keys:?}", items.len(), page["page"]["has_more"]);
        let id = items[0]["run_id"].as_str().unwrap();
        let detail = show(tg(), id).unwrap();
        let item = detail["item"].as_object().unwrap();
        println!(
            "show: keys={:?}, events={}",
            item.keys().collect::<Vec<_>>(),
            item["events"].as_array().unwrap().len()
        );
    }
}
