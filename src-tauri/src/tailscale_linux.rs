use serde::Serialize;
use std::path::Path;

// Tailscale's own install commands for this Linux, read from /etc/os-release. Every command is built from constants
// and from a release name or number that is on a list below, never from os-release text, because the guide opens them
// in a terminal (rule 2). Sources:
// - the per-release commands on <https://pkgs.tailscale.com/stable/#linux>, which <https://tailscale.com/docs/install/linux>
//   (kb/1031) links for each distribution;
// - which ID maps to which repository, and the dnf 5 form, from Tailscale's installer
//   (<https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh>), the script tailscale.com/download/linux runs;
// - Arch from the data of <https://tailscale.com/download/linux/arch>; the page itself now shows only the script, so
//   the guide links the Arch Wiki page that kb/1031 names.
// `sudo tailscale up` is left out: the guide's next step logs in, after the operator is set.

const PKGS: &str = "https://pkgs.tailscale.com/stable";
const INSTALLER: &str = "https://github.com/tailscale/tailscale/blob/main/scripts/installer.sh";
pub const DOCS: &str = "https://tailscale.com/docs/install/linux";
pub const INSTALL_LINE: &str = "curl -fsSL https://tailscale.com/install.sh | sh";

/// Releases whose section on pkgs.tailscale.com uses the keyring file; older ones need `apt-key` and get the script.
const UBUNTU: [&str; 13] = [
    "focal", "groovy", "hirsute", "impish", "jammy", "kinetic", "lunar", "mantic", "noble", "oracular", "plucky",
    "questing", "resolute",
];
const DEBIAN: [&str; 5] = ["bullseye", "bookworm", "trixie", "forky", "sid"];
const RASPBIAN: [&str; 3] = ["bullseye", "bookworm", "trixie"];
const LEAP: [&str; 8] = ["15.0", "15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "16.0"];
/// The installer reads these IDs as Ubuntu and uses `UBUNTU_CODENAME`.
const UBUNTU_LIKE: [&str; 7] = ["ubuntu", "pop", "neon", "tuxedo", "linuxmint", "elementary", "zorin"];
/// The installer sends these to Tailscale's Fedora repository.
const FEDORA_LIKE: [&str; 3] = ["fedora", "rocky", "almalinux"];
/// Fedora 41 moved to dnf 5, which takes `addrepo` instead of `--add-repo`.
const DNF5_FROM: u32 = 41;

/// Which part of the website's guide covers this system.
#[derive(Serialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum Family {
    Debian,
    Fedora,
    Opensuse,
    Arch,
    Nixos,
    Other,
}

#[derive(Serialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum Method {
    /// Adds Tailscale's own package source, so system updates keep Tailscale current.
    Repo,
    /// The distribution's own package, updated with the system.
    Package,
    /// A line for the system's configuration file (NixOS); nothing to run.
    Config,
    /// No commands for this release: Tailscale's install script finds its way.
    Script,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Linux {
    /// `PRETTY_NAME`, shown only, never part of a command.
    pub name: String,
    pub family: Family,
    pub method: Method,
    pub commands: Vec<String>,
    /// Where Tailscale publishes these commands.
    pub source: String,
    /// Whether Tailscale's package source is set up; None where the method has none.
    pub updates: Option<bool>,
}

fn field<'a>(os_release: &'a str, key: &str) -> Option<&'a str> {
    os_release.lines().find_map(|l| {
        let v = l.trim().strip_prefix(key)?.strip_prefix('=')?;
        let v = v.trim().trim_matches('"').trim_matches('\'');
        (!v.is_empty()).then_some(v)
    })
}

fn listed(list: &[&'static str], value: Option<&str>) -> Option<&'static str> {
    let value = value?;
    list.iter().copied().find(|v| *v == value)
}

fn major(os_release: &str) -> Option<u32> {
    field(os_release, "VERSION_ID")?.split('.').next()?.parse().ok()
}

fn apt(dist: &str, codename: &str) -> (Vec<String>, String) {
    let commands = vec![
        "sudo mkdir -p --mode=0755 /usr/share/keyrings".to_string(),
        format!(
            "curl -fsSL {PKGS}/{dist}/{codename}.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null"
        ),
        format!(
            "curl -fsSL {PKGS}/{dist}/{codename}.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list"
        ),
        "sudo apt-get update && sudo apt-get install tailscale".to_string(),
    ];
    (commands, format!("{PKGS}/#{dist}-{codename}"))
}

/// The plugin that has `config-manager` is missing on minimal installs; Tailscale's installer adds it first, and so
/// do we (a Rocky 9 container failed without it).
const DNF_PLUGIN: &str = "sudo dnf install 'dnf-command(config-manager)'";

/// `repo` is the repository's path under the track, `anchor` its section on pkgs.tailscale.com.
fn dnf(repo: &str, anchor: &str) -> (Vec<String>, String) {
    let commands = vec![
        DNF_PLUGIN.to_string(),
        format!("sudo dnf config-manager --add-repo {PKGS}/{repo}/tailscale.repo"),
        "sudo dnf install tailscale".to_string(),
        "sudo systemctl enable --now tailscaled".to_string(),
    ];
    (commands, format!("{PKGS}/#{anchor}"))
}

fn dnf5() -> (Vec<String>, String) {
    let commands = vec![
        DNF_PLUGIN.to_string(),
        format!("sudo dnf config-manager addrepo --overwrite --from-repofile={PKGS}/fedora/tailscale.repo"),
        "sudo dnf install tailscale".to_string(),
        "sudo systemctl enable --now tailscaled".to_string(),
    ];
    (commands, INSTALLER.to_string())
}

fn yum(repo: &str, anchor: &str) -> (Vec<String>, String) {
    let commands = vec![
        "sudo yum install yum-utils".to_string(),
        format!("sudo yum-config-manager --add-repo {PKGS}/{repo}/tailscale.repo"),
        "sudo yum install tailscale".to_string(),
        "sudo systemctl enable --now tailscaled".to_string(),
    ];
    (commands, format!("{PKGS}/#{anchor}"))
}

fn zypper(repo: &str, anchor: &str) -> (Vec<String>, String) {
    let commands = vec![
        format!("sudo zypper ar -g -r {PKGS}/opensuse/{repo}/tailscale.repo"),
        "sudo zypper ref && sudo zypper in tailscale".to_string(),
        "sudo systemctl enable --now tailscaled".to_string(),
    ];
    (commands, format!("{PKGS}/#{anchor}"))
}

/// Red Hat, `CentOS` and Oracle Linux: one repository per major release, yum before 8.
fn el(os_release: &str, dir: &str) -> Option<(Vec<String>, String)> {
    let v = major(os_release).filter(|v| (7..=10).contains(v))?;
    let repo = format!("{dir}/{v}");
    let anchor = format!("{dir}-{v}");
    Some(if v == 7 { yum(&repo, &anchor) } else { dnf(&repo, &anchor) })
}

fn recipe(os_release: &str) -> Option<(Family, Method, Vec<String>, String)> {
    let id = field(os_release, "ID")?;
    let codename = field(os_release, "VERSION_CODENAME");
    let repo = |family, (commands, source): (Vec<String>, String)| Some((family, Method::Repo, commands, source));
    match id {
        _ if UBUNTU_LIKE.contains(&id) => {
            let c = listed(&UBUNTU, field(os_release, "UBUNTU_CODENAME").or(codename))?;
            repo(Family::Debian, apt("ubuntu", c))
        }
        "debian" => repo(Family::Debian, apt("debian", listed(&DEBIAN, codename)?)),
        "raspbian" => repo(Family::Debian, apt("raspbian", listed(&RASPBIAN, codename)?)),
        "fedora" if major(os_release).is_some_and(|v| v >= DNF5_FROM) => repo(Family::Fedora, dnf5()),
        _ if FEDORA_LIKE.contains(&id) => repo(Family::Fedora, dnf("fedora", "fedora")),
        "rhel" => repo(Family::Fedora, el(os_release, "rhel")?),
        "centos" => repo(Family::Fedora, el(os_release, "centos")?),
        "ol" => repo(Family::Fedora, el(os_release, "oracle")?),
        "amzn" => match field(os_release, "VERSION_ID")? {
            "2" => repo(Family::Fedora, yum("amazon-linux/2", "amazon-linux-2")),
            "2023" => repo(Family::Fedora, yum("amazon-linux/2023", "amazon-linux-2023")),
            _ => None,
        },
        "opensuse-leap" | "sles" => {
            let v = listed(&LEAP, field(os_release, "VERSION_ID"))?;
            repo(Family::Opensuse, zypper(&format!("leap/{v}"), &format!("opensuse-leap-{v}")))
        }
        "opensuse-tumbleweed" => repo(Family::Opensuse, zypper("tumbleweed", "opensuse-tumbleweed")),
        "arch" => Some((
            Family::Arch,
            Method::Package,
            vec!["sudo pacman -S tailscale".into(), "sudo systemctl enable --now tailscaled".into()],
            "https://wiki.archlinux.org/title/Tailscale".into(),
        )),
        "nixos" => {
            Some((Family::Nixos, Method::Config, vec!["services.tailscale.enable = true;".into()], INSTALLER.into()))
        }
        _ => None,
    }
}

fn shown_name(os_release: &str) -> String {
    let name = field(os_release, "PRETTY_NAME").or_else(|| field(os_release, "NAME")).unwrap_or("Linux");
    name.chars().filter(|c| !c.is_control()).take(80).collect()
}

/// The commands for this system, or Tailscale's install script when Tailscale lists none for it.
pub fn linux(os_release: &str) -> Linux {
    let (family, method, commands, source) = recipe(os_release)
        .unwrap_or_else(|| (Family::Other, Method::Script, vec![INSTALL_LINE.to_string()], DOCS.to_string()));
    Linux { name: shown_name(os_release), family, method, commands, source, updates: None }
}

/// The files Tailscale's commands write: apt's list, the `.repo` that dnf and yum keep, zypper's (named for the
/// repository's id in that file).
const SOURCES: [&str; 4] = [
    "/etc/apt/sources.list.d/tailscale.list",
    "/etc/yum.repos.d/tailscale.repo",
    "/etc/zypp/repos.d/tailscale-stable.repo",
    "/etc/apt/sources.list.d/tailscale.sources",
];

/// Package managers that can install `curl`, in the order they are tried, with their install line.
const CURL_FROM: [(&str, &str); 3] = [
    ("apt-get", "sudo apt-get install -y curl"),
    ("dnf", "sudo dnf install -y curl"),
    ("zypper", "sudo zypper install -y curl"),
];

/// A clean desktop may lack `curl`, which the apt lines and the install script start with; the line that installs it
/// goes first. `has` answers whether a program is on PATH.
fn with_curl(mut l: Linux, has: impl Fn(&str) -> bool) -> Linux {
    let needs = l.commands.iter().any(|c| c.starts_with("curl "));
    if needs
        && !has("curl")
        && let Some((_, line)) = CURL_FROM.iter().find(|(manager, _)| has(manager))
    {
        l.commands.insert(0, (*line).to_string());
    }
    l
}

pub fn read() -> Linux {
    let mut l = linux(&std::fs::read_to_string("/etc/os-release").unwrap_or_default());
    if l.method == Method::Repo {
        l.updates = Some(SOURCES.iter().any(|p| Path::new(p).exists()));
    }
    with_curl(l, |bin| crate::paths::find(bin).is_some())
}

/// The line the guide opens in a terminal: this system's commands joined, never the NixOS configuration line.
pub fn terminal_line() -> Result<String, String> {
    let l = read();
    if l.method == Method::Config {
        return Err("On NixOS, Tailscale goes into your system configuration, not a command.".into());
    }
    Ok(l.commands.join(" && "))
}

#[cfg(test)]
mod tests {
    use super::*;

    const UBUNTU_2404: &str = "PRETTY_NAME=\"Ubuntu 24.04.3 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\n\
        VERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nUBUNTU_CODENAME=noble\n";
    const MINT_22: &str = "NAME=\"Linux Mint\"\nVERSION=\"22 (Wilma)\"\nID=linuxmint\nID_LIKE=\"ubuntu debian\"\n\
        PRETTY_NAME=\"Linux Mint 22\"\nVERSION_ID=\"22\"\nVERSION_CODENAME=wilma\nUBUNTU_CODENAME=noble\n";
    const POP: &str = "NAME=\"Pop!_OS\"\nVERSION_ID=\"22.04\"\nID=pop\nID_LIKE=\"ubuntu debian\"\n\
        PRETTY_NAME=\"Pop!_OS 22.04 LTS\"\nVERSION_CODENAME=jammy\nUBUNTU_CODENAME=jammy\n";
    const DEBIAN_13: &str =
        "PRETTY_NAME=\"Debian GNU/Linux 13 (trixie)\"\nVERSION_ID=\"13\"\nVERSION_CODENAME=trixie\nID=debian\n";
    const FEDORA_42: &str =
        "NAME=\"Fedora Linux\"\nVERSION_ID=42\nID=fedora\nPRETTY_NAME=\"Fedora Linux 42 (Container Image)\"\n";
    const FEDORA_40: &str = "NAME=\"Fedora Linux\"\nVERSION_ID=40\nID=fedora\n";
    const ROCKY_9: &str = "NAME=\"Rocky Linux\"\nVERSION_ID=\"9.6\"\nID=\"rocky\"\nID_LIKE=\"rhel centos fedora\"\n";
    const RHEL_9: &str = "NAME=\"Red Hat Enterprise Linux\"\nVERSION_ID=\"9.4\"\nID=\"rhel\"\nID_LIKE=\"fedora\"\n";
    const CENTOS_7: &str = "NAME=\"CentOS Linux\"\nVERSION_ID=\"7\"\nID=\"centos\"\n";
    const AMAZON_2023: &str = "NAME=\"Amazon Linux\"\nVERSION_ID=\"2023\"\nID=\"amzn\"\nID_LIKE=\"fedora\"\n";
    const LEAP_156: &str =
        "NAME=\"openSUSE Leap\"\nVERSION_ID=\"15.6\"\nID=\"opensuse-leap\"\nID_LIKE=\"suse opensuse\"\n";
    const TUMBLEWEED: &str = "NAME=\"openSUSE Tumbleweed\"\nVERSION_ID=\"20251020\"\nID=\"opensuse-tumbleweed\"\nID_LIKE=\"opensuse suse\"\n";
    const ARCH: &str = "NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\nID=arch\nBUILD_ID=rolling\n";
    const MANJARO: &str = "NAME=\"Manjaro Linux\"\nID=manjaro\nID_LIKE=arch\nPRETTY_NAME=\"Manjaro Linux\"\n";
    const NIXOS: &str = "NAME=NixOS\nID=nixos\nVERSION_ID=\"25.05\"\nPRETTY_NAME=\"NixOS 25.05 (Warbler)\"\n";
    const ALPINE: &str = "NAME=\"Alpine Linux\"\nID=alpine\nVERSION_ID=3.22.2\nPRETTY_NAME=\"Alpine Linux v3.22\"\n";

    #[test]
    fn ubuntu_and_its_derivatives_use_the_ubuntu_release() {
        let l = linux(UBUNTU_2404);
        assert_eq!((l.family, l.method), (Family::Debian, Method::Repo));
        assert_eq!(l.name, "Ubuntu 24.04.3 LTS");
        assert_eq!(l.source, "https://pkgs.tailscale.com/stable/#ubuntu-noble");
        assert_eq!(
            l.commands[1],
            "curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | sudo tee \
             /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null"
        );
        assert_eq!(linux(MINT_22).commands, l.commands);
        assert!(linux(POP).commands[2].contains("/ubuntu/jammy.tailscale-keyring.list"));
    }

    #[test]
    fn debian_by_codename() {
        let l = linux(DEBIAN_13);
        assert_eq!(l.source, "https://pkgs.tailscale.com/stable/#debian-trixie");
        assert_eq!(l.commands.last().unwrap(), "sudo apt-get update && sudo apt-get install tailscale");
    }

    #[test]
    fn fedora_41_and_later_get_the_dnf5_form() {
        assert!(linux(FEDORA_42).commands[1].starts_with("sudo dnf config-manager addrepo --overwrite"));
        assert_eq!(
            linux(FEDORA_40).commands[1],
            "sudo dnf config-manager --add-repo https://pkgs.tailscale.com/stable/fedora/tailscale.repo"
        );
        assert_eq!(linux(ROCKY_9).commands, linux(FEDORA_40).commands);
    }

    #[test]
    fn enterprise_linux_by_major_release() {
        assert_eq!(
            linux(RHEL_9).commands[1],
            "sudo dnf config-manager --add-repo https://pkgs.tailscale.com/stable/rhel/9/tailscale.repo"
        );
        assert_eq!(linux(RHEL_9).source, "https://pkgs.tailscale.com/stable/#rhel-9");
        assert_eq!(linux(CENTOS_7).commands[0], "sudo yum install yum-utils");
        assert!(linux(AMAZON_2023).commands[1].ends_with("/amazon-linux/2023/tailscale.repo"));
    }

    #[test]
    fn opensuse_leap_and_tumbleweed() {
        assert_eq!(
            linux(LEAP_156).commands[0],
            "sudo zypper ar -g -r https://pkgs.tailscale.com/stable/opensuse/leap/15.6/tailscale.repo"
        );
        assert_eq!(linux(TUMBLEWEED).source, "https://pkgs.tailscale.com/stable/#opensuse-tumbleweed");
    }

    #[test]
    fn arch_package_and_nixos_configuration() {
        let arch = linux(ARCH);
        assert_eq!((arch.family, arch.method), (Family::Arch, Method::Package));
        assert_eq!(arch.commands[0], "sudo pacman -S tailscale");
        let nixos = linux(NIXOS);
        assert_eq!((nixos.family, nixos.method), (Family::Nixos, Method::Config));
    }

    #[test]
    fn everything_else_gets_the_install_script() {
        for os in [MANJARO, ALPINE, "", "ID=ubuntu\nUBUNTU_CODENAME=bionic\n", "ID=debian\nVERSION_CODENAME=buster\n"] {
            let l = linux(os);
            assert_eq!(
                (l.family, l.method, l.commands.clone()),
                (Family::Other, Method::Script, vec![INSTALL_LINE.to_string()]),
                "{os}"
            );
        }
    }

    #[test]
    fn os_release_text_never_reaches_a_command() {
        let evil = "ID=ubuntu\nUBUNTU_CODENAME=\"noble; rm -rf ~\"\n";
        assert_eq!(linux(evil).method, Method::Script);
        let evil_version = "ID=rhel\nVERSION_ID=\"9$(reboot)\"\n";
        assert_eq!(linux(evil_version).method, Method::Script);
        let name = linux("ID=arch\nPRETTY_NAME=\"Arch\u{1b}[31m\"\n").name;
        assert!(!name.contains('\u{1b}'));
    }

    #[test]
    fn installs_curl_first_where_the_commands_need_it_and_it_is_missing() {
        let apt_only = |bin: &str| bin == "apt-get";
        let l = with_curl(linux(UBUNTU_2404), apt_only);
        assert_eq!(l.commands[0], "sudo apt-get install -y curl");
        assert_eq!(l.commands.len(), 5);
        assert_eq!(with_curl(linux(UBUNTU_2404), |_| true).commands, linux(UBUNTU_2404).commands);
        let script = with_curl(linux(ALPINE), |bin| bin == "zypper");
        assert_eq!(script.commands, vec!["sudo zypper install -y curl".to_string(), INSTALL_LINE.to_string()]);
        assert_eq!(with_curl(linux(ALPINE), |_| false).commands, vec![INSTALL_LINE.to_string()]);
        for os in [FEDORA_42, LEAP_156, ARCH, NIXOS] {
            assert_eq!(with_curl(linux(os), |b| b != "curl").commands, linux(os).commands, "{os}");
        }
    }
}
