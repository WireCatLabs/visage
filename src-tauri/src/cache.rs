//! What the app remembers about a tool's program while it runs, so a page visit does not start the same process
//! again. Memory only: a new app start asks every tool afresh.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

/// Which program file a path runs, and that file's size and change time. npm replaces the package files on an
/// install or update and pnpm rewrites its launcher, so a new version always gives a new stamp.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stamp {
    target: PathBuf,
    modified: Option<SystemTime>,
    len: u64,
}

impl Stamp {
    pub fn of(path: &Path) -> Option<Stamp> {
        let target = std::fs::canonicalize(path).ok()?;
        let meta = std::fs::metadata(&target).ok()?;
        Some(Stamp { modified: meta.modified().ok(), len: meta.len(), target })
    }
}

/// (tool id, command) → the program that refused it, and its answer.
type Refusals = HashMap<(String, &'static str), (Stamp, String)>;

/// Commands a tool's installed version refused as unknown, with the tool's own answer, so the doomed call is
/// skipped until that program changes.
#[derive(Default)]
pub struct Unsupported(Mutex<Refusals>);

pub static REFUSED: LazyLock<Unsupported> = LazyLock::new(Unsupported::default);

impl Unsupported {
    /// The remembered refusal, while `program` is still the version that gave it.
    pub fn known(&self, tool: &str, command: &'static str, program: &Path) -> Option<String> {
        let now = Stamp::of(program)?;
        let map = self.0.lock().unwrap();
        map.get(&(tool.to_string(), command)).filter(|(stamp, _)| *stamp == now).map(|(_, answer)| answer.clone())
    }

    pub fn remember(&self, tool: &str, command: &'static str, program: &Path, answer: &str) {
        if let Some(stamp) = Stamp::of(program) {
            self.0.lock().unwrap().insert((tool.to_string(), command), (stamp, answer.to_string()));
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::fs::File;
    use std::time::Duration;

    /// A program file in a fresh temp folder; the folder is removed when the guard drops.
    pub struct TempProgram(pub PathBuf);

    impl TempProgram {
        pub fn new(name: &str) -> TempProgram {
            let dir = std::env::temp_dir().join(format!("wirecat-{name}-{}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let path = dir.join(name);
            std::fs::write(&path, "1.0.0").unwrap();
            TempProgram(path)
        }

        /// What an update does to the file: new contents written at a later time.
        pub fn update(&self, contents: &str) {
            std::fs::write(&self.0, contents).unwrap();
            let later = SystemTime::now() + Duration::from_secs(5);
            File::options().write(true).open(&self.0).unwrap().set_modified(later).unwrap();
        }
    }

    impl Drop for TempProgram {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
        }
    }

    #[test]
    fn a_new_change_time_or_size_is_a_new_stamp() {
        let p = TempProgram::new("stamp");
        let first = Stamp::of(&p.0).unwrap();
        assert_eq!(Stamp::of(&p.0), Some(first.clone()));
        p.update("1.0.0");
        assert_ne!(Stamp::of(&p.0).unwrap(), first, "same size, later time");
        let second = Stamp::of(&p.0).unwrap();
        File::options().write(true).open(&p.0).unwrap().set_len(2).unwrap();
        assert_ne!(Stamp::of(&p.0).unwrap().len, second.len);
        assert_eq!(Stamp::of(Path::new("/no/such/program")), None);
    }

    #[test]
    fn a_refusal_is_forgotten_once_the_program_changes() {
        let p = TempProgram::new("refusal");
        let memory = Unsupported::default();
        assert_eq!(memory.known("zm", "runs list", &p.0), None);
        memory.remember("zm", "runs list", &p.0, "unknown command 'runs'");
        assert_eq!(memory.known("zm", "runs list", &p.0).as_deref(), Some("unknown command 'runs'"));
        assert_eq!(memory.known("drive", "runs list", &p.0), None);
        p.update("2.0.0");
        assert_eq!(memory.known("zm", "runs list", &p.0), None);
    }
}
