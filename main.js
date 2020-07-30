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

// TODO: config no repo do dl one

module.exports = main;
async function main(config) {
  const cwd = process.cwd();
  const filePath = path.join(cwd, config.file);

  await demand.gitRepository(cwd);
  await demand.file(filePath);

  const defaultTokenFile = `${process.env.HOME}/.github.token`;
  if (!config.apiKey) {
    config.apiKey = await tryToGetDataFromFiles([defaultTokenFile]);
  }

  if (!config.apiKey) {
    config.apiKey = await prompt("What's your GitHub API token? ");
    await fs.writeFile(defaultTokenFile, config.apiKey);
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

  const user = await withSpinner(
    "Loading user",
    api.get("user"),
    "Failed to load user",
    config.debug
  );

  const [prs, issues, gists] = await withSpinner(
    "Loading issues, pull requests and gists",
    Promise.all([
      api.get("search/issues", {
        searchParams: {
          q: `is:pr ${config.queriesExtra || ""} ${config.prsQueryExtra || ""}`,
        },
      }),

      api.get("search/issues", {
        searchParams: {
          q: `is:pr ${config.queriesExtra || ""} ${
            config.issuesQueryExtra || ""
          }`,
        },
      }),

      api.get("gists", {
        searchParams: {
          q: `is:pr ${config.queriesExtra || ""} ${
            config.gistsQueryExtra || ""
          }`,
        },
      }),
    ]),
    "Failed to load items",
    config.debug
  );

  const tmpFilePath = path.join(os.tmpdir(), "daily-status-message");
  await fs.writeFile(
    tmpFilePath,
    renderer.renderFile(config, {
      user,
      prs: prs.items,
      issues: issues.items,
      gists,
    })
  );
  const modifications = await editFileOnEditor(tmpFilePath);
  const userDailyMarkup = renderer.prepareDailyForUser(
    config,
    user,
    modifications
  );

  if (!userDailyMarkup.length) {
    console.error("Empty modifications, aborting");
    process.exit(1);
  }

  const currentText = await withSpinner(
    "Reading file",
    fs.readFile(filePath, "utf-8")
  );

  const updatedUserText = renderer.replaceUserStatus(
    config,
    user,
    currentText,
    userDailyMarkup
  );

  const finalText = renderer.replaceDate(config, new Date(), updatedUserText);

  await withSpinner("Saving file", fs.writeFile(filePath, finalText, "utf-8"));

  const branchName = await withSpinner(
    "Getting current branch",
    git.getBranchName(cwd)
  );

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
    let hasConflicts = true;
    while (hasConflicts) {
      const status = await withSpinner(
        "Getting conflict status",
        git.diff(cwd, ["--check"]).catch((x) => x)
      );
      const conflicted = Array.from(
        new Set(
          status.stdout
            .trim()
            .split("\n")
            .filter((line) => line.includes("leftover conflict"))
            .map((line) => line.slice(0, line.indexOf(":")))
        )
      );

      hasConflicts = conflicted.length > 0;

      for (let file of conflicted) {
        await editFileOnEditor(path.join(cwd, file));
      }
    }
    await withSpinner("Adding files", git.add(cwd, ["."]));
    await withSpinner("Continuing rebase", git.rebase(cwd, ["--continue"]));
  }
  await withSpinner("Pushing", git.push(cwd, []));

  process.exit(0);
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
      if (!answer) {
        reject();
      }
      resolve(answer);
    });
  });
}

async function editFileOnEditor(file) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(process.env.EDITOR, [file], {
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
