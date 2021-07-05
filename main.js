const os = require("os");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs").promises;
const renderer = require("./renderer");
const git = require("./git");
const demand = require("./demand");
const ora = require("ora");
const readline = require("readline");
const got = require("got");

module.exports = main;
async function main(config) {
  const cwd = process.cwd();
  const filePath = path.join(cwd, config.file);

  await demand.gitRepository(cwd);
  await demand.file(filePath);

  if (!config.apiKey) {
    config.apiKey = await tryToGetDataFromFiles([config.apiKeyFile]);
  }

  if (!config.apiKey) {
    config.apiKey = await prompt("What's your GitHub API token? ");
    if (!config.apiKey.length) {
      console.error("Token cannot be blank");
      process.exit(1);
    }
    if (await promptConfirmation(`Save key at ${config.apiKeyFile}?`)) {
      await fs.writeFile(config.apiKeyFile, config.apiKey);
    }
  }

  config.apiKey = config.apiKey.trim();

  demand.string(config.apiKey, "apiKey");

  const api = got.extend({
    prefixUrl: "https://api.github.com",
    responseType: "json",
    resolveBodyOnly: true,
    headers: {
      Authorization: `token ${config.apiKey}`,
    },
  });

  const usernames = [].concat(config.users || [])
  const users = await withSpinner(
    usernames.length ? "Loading users" : "Loading user",
    Promise.all(
      usernames.length ? 
        usernames.map(username => api.get(`users/${username}`)) :
        [api.get("user")]
    ),
    "Failed to load users",
    config.debug
  )

  const usersWithMarkup = (
    await Promise.all(users.map(user => renderTextForUser(config, api, cwd, user)))
  ).filter(x => x)

  const shouldAbort = !usersWithMarkup.length
  if (shouldAbort) {
    process.exit(0)
    return
  }

  const shouldDeploy = config.isAutoTool || (
    typeof config.deploy === "boolean"
      ? config.deploy
      : await promptConfirmation("Commit and push changes?")
  );

  if (!shouldDeploy) {
    process.exit(0);
  }

  const branchName = await withSpinner(
    "Getting current branch",
    git.getBranchName(cwd)
  );

  try {
    await withSpinner(
      "Rebasing",
      git.pull(cwd, ["--rebase", config.remote, branchName])
    );
  } catch (err) {
    if (!err.stdout.includes("Resolve all conflicts manually")) {
      throw err;
    }
    await git.checkout(cwd, ["--theirs", "."]);
    await git.add(cwd, ["."]);
    try {
      await git.rebase(cwd, ["--continue"]);
    } catch (continueErr) {
      if (
        !continueErr.stdout.includes(
          "No changes - did you forget to use 'git add'?"
        )
      ) {
        throw err;
      }

      await git.rebase(cwd, ["--skip"]);
    }
  }

  const currentText = await withSpinner(
    "Reading file",
    fs.readFile(filePath, "utf-8")
  );

  const updatedUserText = usersWithMarkup
    .reduce((textAcc, [user, userDailyMarkup]) =>
      renderer.replaceUserStatus(
        config,
        user,
        textAcc,
        userDailyMarkup
      )
    , currentText)

  const finalText = renderer.replaceDate(config, new Date(), updatedUserText);

  await withSpinner("Saving file", fs.writeFile(filePath, finalText, "utf-8"));
  if (config.reset === true) {
    await fs.unlink(tmpFilePath);
  }

  const commitMessage = "Update".replace(/'/g, "\\'");

  await withSpinner("Staging file", git.add(cwd, ["."]));
  await withSpinner(
    "Commiting",
    git.commit(cwd, ["-m", `'${commitMessage}'`, "--allow-empty"])
  );
  try {
    await withSpinner(
      "Rebasing",
      git.pull(cwd, ["--rebase", config.remote, branchName])
    );
  } catch (err) {
    if (!err.stdout.includes("Resolve all conflicts manually")) {
      throw err;
    }
    console.log("Fix rebase merge conflicts manually then push updates");
    process.exit(1);
  }

  await withSpinner("Pushing", git.push(cwd, []));
  process.exit(0);
}

async function renderTextForUser(config, api, cwd, user) {
  const [prs, issues, gists] = await withSpinner(
    `Loading issues, pull requests and gists for ${user.login}`,
    Promise.all([
      api.get("search/issues", {
        searchParams: {
          q: `is:pr author:${user.login} ${config.queriesExtra || ""} ${config.prsQueryExtra || ""}`,
        },
      }),

      api.get("search/issues", {
        searchParams: {
          q: `is:issue assignee:${user.login} ${config.queriesExtra || ""} ${
            config.issuesQueryExtra || ""
          }`,
        },
      }),

      api.get("gists", {
        searchParams: {
          q: `${config.queriesExtra || ""} ${config.gistsQueryExtra || ""}`,
        },
      }),
    ]),
    "Failed to load items",
    config.debug
  );

  const gitDir = path.join(cwd, ".git");
  const tmpFilePath = path.join(gitDir, "daily-status-message");

  let hasTmpFile = !config.isAutoTool && await fileExists(tmpFilePath);
  if (hasTmpFile) {
    const shouldReset =
      typeof config.reset === "boolean"
        ? config.reset
        : await promptConfirmation("Reset current status?");

    if (shouldReset) {
      await fs.unlink(tmpFilePath);
      hasTmpFile = false;
    }
  }

  const currentRenderedFile =
    hasTmpFile && (await fs.readFile(tmpFilePath, "utf-8"));

  const originallyRendered = renderer.renderFile(config, {
    currentRenderedFile,
    user,
    prs: prs.items,
    issues: issues.items,
    gists,
  });

  let modifications = originallyRendered

  if (!config.isAutoTool) {
    await fs.writeFile(tmpFilePath, originallyRendered);
    modifications = await editFileOnEditor(tmpFilePath);
  }

  const userDailyMarkup = renderer.prepareDailyForUser(
    config,
    user,
    modifications
  );

  // No need to handle user inputs
  if (config.isAutoTool) {
    return [user, userDailyMarkup]
  }

  if (!userDailyMarkup.length) {
    console.error("Empty modifications, aborting");
    return false
  }

  if (
    originallyRendered.trim() === modifications.trim() &&
    !(await promptConfirmation("Nothing changed! Continue?"))
  ) {
    return false
  }

  return [user, userDailyMarkup]
}

async function promptConfirmation(text) {
  const response = await prompt(`${text} (y/n) `);
  return ["yes", "y", "true", "ok"].includes(response.trim().toLowerCase());
}

async function prompt(text) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    let answer;

    rl.question(text, function (got) {
      answer = got;
      rl.close();
    });

    rl.on("close", function () {
      resolve(answer);
    });
  });
}

async function editFileOnEditor(file) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(process.env.EDITOR || 'vim', [file], {
      stdio: "inherit",
    });

    child.on("exit", async (err, code) => {
      if (err) {
        return reject(err);
      }
      resolve(await fs.readFile(file, "utf-8"));
    });
  });
}

async function mergetool() {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn("git", ["mergetool"], {
      stdio: "inherit",
    });

    child.on("exit", async (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function fileExists(pathTo) {
  return fs
    .access(pathTo)
    .then(() => true)
    .catch(() => false);
}

async function tryToGetDataFromFiles(possibleFiles) {
  const possibleValues = await Promise.all(
    possibleFiles.map((file) =>
      fs.readFile(path.resolve(file), "utf-8").catch(() => false)
    )
  );

  return possibleValues.find((x) => x);
}

async function withSpinner(text, promise, errorMessage, debug = false) {
  const spinner = ora(text).start();

  try {
    await promise;
    return await promise;
  } catch (err) {
    if (debug) {
      console.error(err);
    }

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    throw err;
  } finally {
    spinner.stop();
  }
}
