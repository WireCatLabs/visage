use crate::archive::{self, Answer};
use crate::catalog::{self, Tool};
use crate::paths;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Serialize, Debug, PartialEq, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct Schema {
    pub version: u64,
    pub min_compatible: u64,
}

/// One installed package's own view of the shared store, from its `store info`.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolView {
    pub id: String,
    /// `answered`, `unknown` (no `store info` in this version) or `failed` (it ran and refused).
    pub outcome: &'static str,
    pub speaks: Option<u64>,
    pub writable: Option<bool>,
    pub reason: Option<String>,
    /// What this tool's next run leaves the store at; absent from tools older than cli-core's `schema.upgrade`.
    pub upgrade: Option<Schema>,
    /// The file's schema as this tool read it.
    pub file: Option<Schema>,
    pub exists: Option<bool>,
    /// The masked refusal, so the interface can read "written by a newer version (schema N, needs at least M".
    pub problem: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Client {
    pub command: String,
    pub version: String,
    pub speaks: u64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StoreCompat {
    pub tools: Vec<ToolView>,
    /// The tools the store itself records as having opened it, from the answer of the tool that reads the most.
    pub clients: Vec<Client>,
}

fn schema(v: &Value) -> Option<Schema> {
    Some(Schema { version: v["version"].as_u64()?, min_compatible: v["min_compatible"].as_u64()? })
}

pub(crate) fn view(id: &str, answer: &Result<Answer, String>) -> ToolView {
    let blank = |outcome, problem| ToolView {
        id: id.into(),
        outcome,
        speaks: None,
        writable: None,
        reason: None,
        upgrade: None,
        file: None,
        exists: None,
        problem,
    };
    match answer {
        Ok(Answer::Envelope(v)) => {
            let item = v.get("item").unwrap_or(v);
            let s = &item["schema"];
            let exists = item["exists"].as_bool();
            ToolView {
                speaks: s["speaks"].as_u64(),
                writable: s["writable"].as_bool(),
                reason: s["reason"].as_str().map(str::to_string),
                upgrade: schema(&s["upgrade"]),
                file: if exists == Some(true) { schema(s) } else { None },
                exists,
                ..blank("answered", None)
            }
        }
        Ok(Answer::Unknown) => blank("unknown", None),
        Err(problem) => blank("failed", Some(problem.clone())),
    }
}

fn clients(answer: &Value) -> Vec<Client> {
    let item = answer.get("item").unwrap_or(answer);
    item["clients"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|c| {
            Some(Client {
                command: c["command"].as_str()?.into(),
                version: c["version"].as_str()?.into(),
                speaks: c["speaks"].as_u64()?,
            })
        })
        .collect()
}

/// Every installed package once, a part (Email) through its owner.
fn installed() -> Vec<&'static Tool> {
    catalog::catalog()
        .tools
        .iter()
        .filter(|t| t.part_of.is_none() && t.store_info.is_some() && paths::find(&t.bin).is_some())
        .collect()
}

/// Asks every installed tool at once: each answer is one `node` start and a read of the file.
pub(crate) fn probe() -> Vec<(&'static Tool, Result<Answer, String>)> {
    let tools = installed();
    std::thread::scope(|scope| {
        let handles: Vec<_> = tools
            .iter()
            .map(|tool| scope.spawn(move || archive::ask(tool, |t| t.store_info.as_ref(), Duration::from_secs(45))))
            .collect();
        tools
            .iter()
            .copied()
            .zip(handles.into_iter().map(|h| h.join().unwrap_or(Err("the check stopped".into()))))
            .collect()
    })
}

/// The answer from the tool that reads the newest schema, which describes the file best.
pub(crate) fn best<'a>(answers: &'a [(&'static Tool, Result<Answer, String>)]) -> Option<(&'static Tool, &'a Value)> {
    answers
        .iter()
        .filter_map(|(tool, answer)| match answer {
            Ok(Answer::Envelope(v)) => Some((*tool, v)),
            _ => None,
        })
        .max_by_key(|(_, v)| v.get("item").unwrap_or(v)["schema"]["speaks"].as_u64().unwrap_or(0))
}

pub fn compat() -> StoreCompat {
    let answers = probe();
    StoreCompat {
        clients: best(&answers).map(|(_, v)| clients(v)).unwrap_or_default(),
        tools: answers.iter().map(|(tool, answer)| view(&tool.id, answer)).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_the_compatibility_a_new_tool_reports() {
        let answer = Ok(Answer::Envelope(json!({"item": {"exists": true, "schema": {
            "version": 31, "min_compatible": 31, "speaks": 33, "writable": true, "reason": "older",
            "upgrade": {"version": 33, "min_compatible": 32}}}})));
        let v = view("drive", &answer);
        assert_eq!(v.outcome, "answered");
        assert_eq!(v.file, Some(Schema { version: 31, min_compatible: 31 }));
        assert_eq!(v.upgrade, Some(Schema { version: 33, min_compatible: 32 }));
        assert_eq!(v.reason.as_deref(), Some("older"));
    }

    #[test]
    fn an_older_tool_gives_no_upgrade_and_a_missing_store_no_file() {
        let old = view(
            "tg",
            &Ok(Answer::Envelope(json!({"item": {"exists": true, "schema": {
            "version": 33, "min_compatible": 32, "speaks": 29, "writable": false}}}))),
        );
        assert_eq!((old.speaks, old.writable, old.upgrade), (Some(29), Some(false), None));
        let missing = view(
            "tg",
            &Ok(Answer::Envelope(json!({"item": {"exists": false, "schema": {
            "version": 0, "min_compatible": 0, "speaks": 33, "writable": true, "reason": "missing"}}}))),
        );
        assert_eq!((missing.file, missing.exists), (None, Some(false)));
    }

    #[test]
    fn keeps_a_refusal_for_the_interface_to_read() {
        let refused = view(
            "wa",
            &Err("the message store was written by a newer version (schema 33, needs at least 32; this one speaks 29)"
                .into()),
        );
        assert_eq!(refused.outcome, "failed");
        assert!(refused.problem.unwrap().contains("schema 33, needs at least 32"));
        assert_eq!(view("zm", &Ok(Answer::Unknown)).outcome, "unknown");
    }

    #[test]
    fn the_best_answer_is_from_the_tool_that_reads_the_newest_schema() {
        let tg = catalog::tool("tg").unwrap();
        let max = catalog::tool("max").unwrap();
        let answers = vec![
            (tg, Ok(Answer::Envelope(json!({"item": {"schema": {"speaks": 29}}})))),
            (
                max,
                Ok(Answer::Envelope(json!({"item": {"schema": {"speaks": 33}, "clients": [
                {"command": "memo", "version": "0.103.0", "core": "0.420.0", "speaks": 33, "seen_at": "x"}]}}))),
            ),
        ];
        let (tool, v) = best(&answers).unwrap();
        assert_eq!(tool.id, "max");
        assert_eq!(clients(v), vec![Client { command: "memo".into(), version: "0.103.0".into(), speaks: 33 }]);
    }
}
