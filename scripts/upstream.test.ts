import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { upstream, type UpstreamConfig } from "./upstream";

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "parrot-upstream-"));
  temporary.push(base);
  const source = join(base, "source");
  const root = join(base, "monorepo");
  const git = (directory: string, ...args: string[]) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  for (const directory of [source, root]) {
    mkdirSync(directory);
    git(directory, "init", "-b", "main");
    git(directory, "config", "user.name", "Fixture");
    git(directory, "config", "user.email", "fixture@example.invalid");
    git(directory, "config", "commit.gpgsign", "false");
    git(directory, "config", "core.hooksPath", "/dev/null");
  }
  writeFileSync(join(source, "feature.txt"), "Original feature\n");
  writeFileSync(
    join(source, "package.json"),
    '{"name":"legacy","dependencies":{"example":"1.0.0"}}\n',
  );
  git(source, "add", ".");
  git(source, "commit", "-m", "Original app");
  const importedCommit = git(source, "rev-parse", "HEAD");
  mkdirSync(join(root, "apps/rewrite"), { recursive: true });
  writeFileSync(
    join(root, "apps/rewrite/feature.txt"),
    "Shadcn implementation\n",
  );
  writeFileSync(
    join(root, "apps/rewrite/package.json"),
    '{"name":"rewrite","dependencies":{"example":"1.0.0"}}\n',
  );
  writeFileSync(join(root, ".gitignore"), ".upstream-reviews/\n");
  const config: UpstreamConfig = {
    repository: source,
    branch: "main",
    prefix: "apps/legacy",
    importedCommit,
  };
  writeFileSync(join(root, "upstream.json"), JSON.stringify(config));
  git(root, "add", ".");
  git(root, "commit", "-m", "Monorepo");
  git(
    root,
    "subtree",
    "add",
    "--prefix=apps/legacy",
    "--squash",
    source,
    "main",
  );
  const advance = (text: string) => {
    writeFileSync(join(source, "feature.txt"), text);
    writeFileSync(
      join(source, "package.json"),
      '{"name":"legacy","dependencies":{"example":"2.0.0"}}\n',
    );
    git(source, "add", ".");
    git(source, "commit", "-m", `Feature: ${text.trim()}`);
    return git(source, "rev-parse", "HEAD");
  };
  return {
    root,
    source,
    importedCommit,
    advance,
    git: (...args: string[]) => git(root, ...args),
    sync: upstream(root),
  };
}

test("checking reports incoming features without changing either app or tracked files", () => {
  const f = fixture();
  const before = f.git("rev-parse", "HEAD^{tree}");
  const target = f.advance("New question feature\n");
  const review = f.sync.check();
  expect(review.target).toBe(target);
  expect(review.changed).toBe(true);
  expect(
    readFileSync(join(f.root, ".upstream-reviews", `${target}.md`), "utf8"),
  ).toContain("+New question feature");
  expect(f.git("rev-parse", "HEAD^{tree}")).toBe(before);
  expect(f.git("status", "--porcelain")).toBe("");
});

test("importing changes only legacy and creates an unchecked feature-port checklist", () => {
  const f = fixture();
  const rewrite = f.git("rev-parse", "HEAD:apps/rewrite");
  const target = f.advance("New question feature\n");
  f.sync.check();
  f.sync.update(target);
  expect(readFileSync(join(f.root, "apps/legacy/feature.txt"), "utf8")).toBe(
    "New question feature\n",
  );
  expect(f.git("rev-parse", "HEAD:apps/rewrite")).toBe(rewrite);
  expect(f.git("rev-parse", "HEAD:apps/legacy")).toBe(
    f.git("rev-parse", `${target}^{tree}`),
  );
  expect(
    JSON.parse(readFileSync(join(f.root, "upstream.json"), "utf8"))
      .importedCommit,
  ).toBe(target);
  expect(
    readFileSync(
      join(f.root, `docs/upstream/${target.slice(0, 12)}.md`),
      "utf8",
    ),
  ).toContain("- [ ] [Feature: New question feature]");
  expect(f.git("status", "--porcelain")).toBe("");
  expect(f.sync.check().changed).toBe(false);
});

test("an import uses the reviewed revision even when upstream advances afterward", () => {
  const f = fixture();
  const reviewed = f.advance("Reviewed feature\n");
  f.sync.check();
  const latest = f.advance("Unreviewed feature\n");
  f.sync.update(reviewed);
  expect(readFileSync(join(f.root, "apps/legacy/feature.txt"), "utf8")).toBe(
    "Reviewed feature\n",
  );
  expect(f.sync.check().target).toBe(latest);
});

test("dirty changes and unreviewed revisions are rejected before importing", () => {
  const f = fixture();
  const target = f.advance("New feature\n");
  expect(() => f.sync.update(target)).toThrow("inspect its report first");
  f.sync.check();
  writeFileSync(join(f.root, "apps/rewrite/feature.txt"), "Work in progress\n");
  expect(() => f.sync.update(target)).toThrow("Commit or stash");
  expect(readFileSync(join(f.root, "apps/legacy/feature.txt"), "utf8")).toBe(
    "Original feature\n",
  );
  expect(readFileSync(join(f.root, "apps/rewrite/feature.txt"), "utf8")).toBe(
    "Work in progress\n",
  );
});

test("legacy edits and changed reviews cannot masquerade as an upstream import", () => {
  const f = fixture();
  const target = f.advance("New feature\n");
  f.sync.check();
  writeFileSync(
    join(f.root, ".upstream-reviews", `${target}.md`),
    "Changed report",
  );
  expect(() => f.sync.update(target)).toThrow("stale or changed");
  writeFileSync(
    join(f.root, "apps/legacy/feature.txt"),
    "Local legacy change\n",
  );
  f.git("add", "apps/legacy/feature.txt");
  f.git("commit", "-m", "Local legacy change");
  expect(() => f.sync.check()).toThrow(
    "differs from its recorded upstream snapshot",
  );
});
