use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

fn sensitive_key() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)token|secret|password|passwd|cookie|credential|api_?key|auth_key|session_string|phone|e?mail|address|account|^name$|first_name|last_name|username|viewer_id|device_id|user_id|zoomuser")
            .unwrap()
    })
}

fn sensitive_text() -> &'static [(Regex, &'static str)] {
    static R: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    R.get_or_init(|| {
        vec![
            (Regex::new(r"[\w.+-]+@[\w-]+\.[\w.-]+").unwrap(), "[email]"),
            (Regex::new(r"\+?\d[\d\s-]{8,}\d").unwrap(), "[number]"),
            (Regex::new(r"\b\d{6,}:[\w-]{30,}\b").unwrap(), "[bot token]"),
        ]
    })
}

/// Doctor output reaches the screen and the clipboard, so identifiers and secrets are masked.
/// Booleans and nulls stay: "token present: true" is the useful part and reveals nothing.
pub fn json(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (k, v) in map.iter_mut() {
                if sensitive_key().is_match(k)
                    && (matches!(v, Value::String(_) | Value::Number(_)) || is_scalar_list(v))
                {
                    *v = Value::String("•••".into());
                } else {
                    json(v);
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(json),
        Value::String(s) => *s = text(s),
        _ => {}
    }
}

fn is_scalar_list(v: &Value) -> bool {
    v.as_array().is_some_and(|a| a.iter().all(|x| x.is_string() || x.is_number()))
}

pub fn text(s: &str) -> String {
    let mut out = crate::paths::tilde(s);
    for (re, with) in sensitive_text() {
        out = re.replace_all(&out, *with).into_owned();
    }
    out
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn masks_identifiers_keeps_flags() {
        let mut v = json!({
            "items": [{"profile": "personal", "account": "+34 600 000 000", "name": "Ann"}],
            "token": {"present": true, "from": "keyring"},
            "mail": {"accounts": [{"address": "a@b.com"}]},
            "note": "write to a@b.com"
        });
        super::json(&mut v);
        assert_eq!(v["items"][0]["profile"], "personal");
        assert_eq!(v["items"][0]["account"], "•••");
        assert_eq!(v["items"][0]["name"], "•••");
        assert_eq!(v["token"]["present"], true);
        assert_eq!(v["mail"]["accounts"][0]["address"], "•••");
        assert_eq!(v["note"], "write to [email]");
    }
}
