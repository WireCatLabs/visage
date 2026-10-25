use serde_json::Value;

pub fn list(tool: &crate::catalog::Tool, _query: Option<&str>) -> Result<Value, String> {
    let src = tool.runs.as_ref().ok_or("This tool does not keep run logs yet.")?;
    Err(format!("Logs are not built yet ({}).", src.list.join(" ")))
}

pub fn show(tool: &crate::catalog::Tool, _run: &str) -> Result<Value, String> {
    let src = tool.runs.as_ref().ok_or("This tool does not keep run logs yet.")?;
    Err(format!("Logs are not built yet ({}).", src.show.join(" ")))
}
