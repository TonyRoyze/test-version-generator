import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type UpstreamConfig = {
  repository: string;
  branch: string;
  prefix: string;
  importedCommit: string;
  rewriteSourceCommit?: string;
  rewriteUpstreamBaseline?: string;
};

type Review = {
  repository: string;
  branch: string;
  base: string;
  target: string;
  digest: string;
};

/** Keep upstream imports confined to the legacy subtree. */
export function upstream(root: string) {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const configPath = join(root, "upstream.json");
  const config = (): UpstreamConfig => {
    const value = JSON.parse(
      readFileSync(configPath, "utf8"),
    ) as UpstreamConfig;
    if (value.prefix !== "apps/legacy")
      throw new Error("Only apps/legacy can receive upstream imports.");
    if (!/^[a-f0-9]{40}$/.test(value.importedCommit))
      throw new Error("The imported commit must be a full Git SHA.");
    return value;
  };
  const clean = () => {
    if (git("status", "--porcelain"))
      throw new Error(
        "Commit or stash your changes before checking or importing upstream.",
      );
  };
  const snapshot = (value: UpstreamConfig) => {
    if (
      git("rev-parse", `HEAD:${value.prefix}`) !==
      git("rev-parse", `${value.importedCommit}^{tree}`)
    ) {
      throw new Error(
        "apps/legacy differs from its recorded upstream snapshot. Keep local feature changes in apps/rewrite.",
      );
    }
  };
  const ancestor = (base: string, target: string) => {
    try {
      git("merge-base", "--is-ancestor", base, target);
    } catch {
      throw new Error(
        "Upstream history diverged or moved backwards. Inspect it manually before importing.",
      );
    }
  };
  const reports = join(root, ".upstream-reviews");
  const reportPath = (sha: string) => join(reports, `${sha}.md`);
  const digest = (file: string) =>
    createHash("sha256").update(readFileSync(file)).digest("hex");
  const describe = (base: string, target: string) => {
    const commits = git(
      "log",
      "--reverse",
      "--format=%H %s",
      `${base}..${target}`,
    );
    const files = git("diff", "--name-status", base, target);
    const diff = git("diff", "--no-ext-diff", "--no-textconv", base, target);
    return { commits, files, diff };
  };
  return {
    check() {
      clean();
      const value = config();
      snapshot(value);
      git("fetch", "--no-tags", value.repository, value.branch);
      const target = git("rev-parse", "FETCH_HEAD");
      ancestor(value.importedCommit, target);
      if (target === value.importedCommit)
        return {
          target,
          changed: false,
          message: `Legacy is current at ${target}.`,
        };
      const changes = describe(value.importedCommit, target);
      mkdirSync(reports, { recursive: true });
      writeFileSync(
        reportPath(target),
        `# Upstream review\n\nSource: ${value.repository}\nBranch: ${value.branch}\nBase: ${value.importedCommit}\nTarget: ${target}\n\n## Commits\n\n\`\`\`text\n${changes.commits}\n\`\`\`\n\n## Changed files\n\n\`\`\`text\n${changes.files}\n\`\`\`\n\n## Patch\n\n\`\`\`diff\n${changes.diff}\n\`\`\`\n`,
      );
      const review: Review = {
        repository: value.repository,
        branch: value.branch,
        base: value.importedCommit,
        target,
        digest: digest(reportPath(target)),
      };
      writeFileSync(
        join(reports, `${target}.json`),
        JSON.stringify(review, null, 2) + "\n",
      );
      return {
        target,
        changed: true,
        message: `${changes.commits}\n\n${changes.files}\n\nReview ${reportPath(target)}.\nThen import exactly this revision: bun run upstream:update ${target}`,
      };
    },
    update(target: string) {
      if (!/^[a-f0-9]{40}$/.test(target ?? ""))
        throw new Error(
          "Pass the full reviewed commit SHA from bun run upstream:check.",
        );
      clean();
      const value = config();
      snapshot(value);
      if (target === value.importedCommit)
        throw new Error("That revision is already imported.");
      const reviewFile = join(reports, `${target}.json`);
      if (!existsSync(reviewFile))
        throw new Error(
          "Run bun run upstream:check and inspect its report first.",
        );
      const review = JSON.parse(readFileSync(reviewFile, "utf8")) as Review;
      if (
        review.target !== target ||
        review.base !== value.importedCommit ||
        review.repository !== value.repository ||
        review.branch !== value.branch ||
        review.digest !== digest(reportPath(target))
      ) {
        throw new Error(
          "The upstream review is stale or changed. Run bun run upstream:check again.",
        );
      }
      ancestor(value.importedCommit, target);
      const before = git("rev-parse", "HEAD:apps/rewrite");
      const changes = describe(value.importedCommit, target);
      // Merge a pinned, already fetched revision. A moving main cannot change
      // what was reviewed, and nothing is merged into the rewrite.
      git(
        "subtree",
        "merge",
        `--prefix=${value.prefix}`,
        "--squash",
        target,
        "-m",
        `Import upstream ${target.slice(0, 12)} into legacy`,
      );
      if (git("rev-parse", "HEAD:apps/rewrite") !== before)
        throw new Error(
          "The rewrite tree unexpectedly changed. Inspect the Git history before continuing.",
        );
      const backlog = `docs/upstream/${target.slice(0, 12)}.md`;
      const lines = changes.commits
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [sha, ...subject] = line.split(" ");
          return `- [ ] [${subject.join(" ")}](${value.repository.replace(/\.git$/, "")}/commit/${sha}) — decide: port / already present / skip; record rewrite commit and validation.`;
        });
      mkdirSync(join(root, "docs/upstream"), { recursive: true });
      writeFileSync(
        join(root, backlog),
        `# Upstream import ${target.slice(0, 12)}\n\nImported into apps/legacy only. No features have been automatically ported.\n\nBase: ${value.importedCommit}\nTarget: ${target}\n\n## Porting decisions\n\n${lines.join("\n")}\n\n## Files to inspect\n\n\`\`\`text\n${changes.files}\n\`\`\`\n`,
      );
      writeFileSync(
        configPath,
        JSON.stringify({ ...value, importedCommit: target }, null, 2) + "\n",
      );
      git("add", "--", "upstream.json", backlog);
      git(
        "commit",
        "-m",
        `Record upstream ${target.slice(0, 12)} porting checklist`,
      );
      return `Imported ${target} into ${value.prefix}. The rewrite is unchanged.\nTrack each feature in ${backlog}.`;
    },
  };
}

if (import.meta.main) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const [command, ...args] = process.argv
    .slice(2)
    .filter((arg) => arg !== "--");
  try {
    const sync = upstream(root);
    if (command === "check") console.log(sync.check().message);
    else if (command === "update") console.log(sync.update(args[0]!));
    else
      throw new Error(
        "Use upstream:check or upstream:update <reviewed full SHA>.",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
