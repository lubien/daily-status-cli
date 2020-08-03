#!/usr/bin/env node
const { Command } = require("commander");
const path = require("path");
const pkg = require("./package.json");
const defaultConfig = require("./config.template.js");
const demand = require("./demand");
const main = require("./main");

const program = new Command();
program.name("daily-status");
program.version(pkg.version);

program
  .option("-c, --config <string>", "config file")
  .option("-f, --file <string>", "markdown file to update. Default: Home.md")
  .option("-a, --api-key <string>", "GitHub API key")
  .option(
    "--api-key-file <string>",
    "File that stores the GitHub API key. Default: ~/.github.token"
  )
  .option("-d, --debug", "output extra debugging")
  .option("--reset", "starts from zero")
  .option("--no-reset", "do not delete the older version if exists")
  .option("--deploy", "deploy chanes without asking")
  .option("--no-deploy", "do not deploy changes")
  .option(
    "-r, --remote <string>",
    "git remote name to pull/push. Default 'origin'"
  )
  .option("--bad-labels <string...>", "issues to ignore by default")
  .option("--bad-milestones <string...>", "milestones to ignore by default")
  .option("--todo-labels <string...>", "issues to mark as To Do")
  .option("--todo-milestones <string...>", "milestones to mark as To Do")
  .option("--doing-labels <string...>", "issues to mark as Doing")
  .option("--doing-milestones <string...>", "milestones to mark as Doing")
  .option("--prs-query-extra <string>", "query string to pull requests query")
  .option("--issues-query-extra <string>", "query string to issues query")
  .option("--gists-query-extra <string>", "query string to gists query")
  .option("--queries-extra <string>", "query string to all queries")
  .option(
    "-C, --custom <keyValue...>",
    "custom option in the format KEY=VALUE",
    (current, acc = {}) => {
      try {
        const [key, value] = current.split("=");
        acc[key.trim()] = value.trim();
        return acc;
      } catch (err) {
        console.error(
          `Invalid value for --custom "${current}". Should be "key=value"`
        );
        process.exit(1);
      }
    }
  );

async function cli() {
  program.parse(process.argv);

  const config = {
    ...defaultConfig,
    template: { ...defaultConfig.template },
    custom: {},
  };

  const editableKeys = [
    { key: "debug", demand: demand.boolean, argsOnly: true },
    { key: "apiKey", demand: demand.string, argsOnly: true },
    { key: "apiKeyFile", demand: demand.string, argsOnly: true },
    { key: "custom", demand: demand.object, argsOnly: true },
    { key: "file", demand: demand.string },
    { key: "remote", demand: demand.string },
    { key: "prsQueryExtra", demand: demand.string },
    { key: "issuesQueryExtra", demand: demand.string },
    { key: "gistsQueryExtra", demand: demand.string },
    { key: "queriesExtra", demand: demand.string },
    { key: "badLabels", demand: demand.arrayOfString },
    { key: "badMilestones", demand: demand.arrayOfString },
    { key: "autoToDoLabels", demand: demand.arrayOfString },
    { key: "autoToDoMilestones", demand: demand.arrayOfString },
    { key: "autoDoingLabels", demand: demand.arrayOfString },
    { key: "autoDoingMilestones", demand: demand.arrayOfString },
  ];

  if (program.config) {
    await demand.file(path.resolve(program.config));
    const customConfigFile = require(path.resolve(program.config));

    if (
      customConfigFile.template != null &&
      typeof customConfigFile.template === "object"
    ) {
      Object.assign(config.template, customConfigFile.template);
    }

    for (let item of editableKeys.filter((item) => !item.argsOnly)) {
      if (customConfigFile[item.key]) {
        item.demand(customConfigFile[item.key], item.key);
        config[item.key] = customConfigFile[item.key];
      }
    }
  }

  for (let item of editableKeys) {
    if (program[item.key]) {
      item.demand(program[item.key], item.key);
      config[item.key] = program[item.key];
    }
  }

  if (program.noDeploy) {
    config.deploy = false;
  }
  if (program.deploy) {
    config.deploy = true;
  }

  if (program.noReset) {
    config.reset = false;
  }
  if (program.reset) {
    config.reset = true;
  }

  config.apiKeyFile = config.apiKeyFile.replace(/^~/, process.env.HOME);

  return config;
}

cli()
  .then(main)
  .catch((err) => {
    if (program.debug) {
      console.log(err);
    } else if (err && err.message) {
      console.error(err.message);
    }
    process.exit(1);
  });
