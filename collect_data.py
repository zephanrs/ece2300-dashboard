# collect_data.py
import os, re, json, requests, datetime
from github import Github, Auth
from dotenv import load_dotenv
from tqdm import tqdm
from zoneinfo import ZoneInfo

load_dotenv()

def strip_ansi(s: str) -> str:
  return re.sub(r"\x1B\[[0-?]*[ -/]*[@-~]", "", s)

def parse_summary(s: str):
  s = strip_ansi(s)
  # Prefer the Summary block if present; else fallback to sim section; else whole log
  m = re.search(r"Summary[\s\S]*$", s, re.I)
  if not m:
    m = re.search(r"Run sim tests[\s\S]*?(?=\n\S|\Z)", s, re.I)
  s = m.group(0) if m else s
  return {n: r.lower() == "passed" for n, r in re.findall(r"(\w+(?:_\w+)*-test).*?(passed|FAILED)", s, re.I)}

parse_group = lambda name: (lambda m: int(m.group(1)) if m else None)(re.search(r"group(\d+)", name, re.I))

def main():
  token = os.getenv("GITHUB_TOKEN")
  if not token: raise EnvironmentError("GITHUB_TOKEN not found")
  cfg   = json.load(open("config.json"))
  gh    = Github(auth=Auth.Token(token))
  org   = gh.get_organization(cfg["org"])
  data  = {}
  hdrs  = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}

  repos = [r for r in org.get_repos() if "group" in r.name.lower()]

  for repo in tqdm(repos, desc="Processing", unit="repo"):
    gnum = parse_group(repo.name)
    if not gnum: continue
    section = cfg["group_to_section"].get(f"{gnum:02d}")
    if not section: continue

    for action, tests in cfg["actions"].items():
      run = next((r for r in repo.get_workflow_runs(status="completed") if r.name == action), None)
      if not run: continue

      # Jobs for this run
      jobs = requests.get(f"https://api.github.com/repos/{org.login}/{repo.name}/actions/runs/{run.id}/jobs",
                          headers=hdrs, timeout=10)
      if jobs.status_code != 200: continue
      jobs = jobs.json().get("jobs", [])
      if not jobs: continue

      job = next((j for j in jobs if j.get("name") == "run_tests"), jobs[0])
      job_id = job["id"]

      # Official job logs endpoint → follows redirect to raw text
      resp = requests.get(f"https://api.github.com/repos/{org.login}/{repo.name}/actions/jobs/{job_id}/logs",
                          headers=hdrs, timeout=20, allow_redirects=True)
      if resp.status_code != 200: continue

      results = parse_summary(resp.text)

      for test in tests:
        passed = results.get(test, False)
        bucket = data.setdefault(action, {}).setdefault(test, {}).setdefault(section, {"pass": 0, "fail": 0})
        bucket["pass" if passed else "fail"] += 1

  data["_last_updated"] = datetime.datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d %I:%M %p %Z")
  json.dump(data, open("docs/report.json", "w"), indent=2)

if __name__ == "__main__":
  main()
