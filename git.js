const child_process = require("child_process");
const util = require("util");

const exec = util.promisify(child_process.exec);

exports.status = gitCommand("status");
exports.diff = gitCommand("diff");
exports.rebase = gitCommand("rebase");
exports.commit = gitCommand("commit");
exports.push = gitCommand("push");
exports.add = gitCommand("add");
exports.pull = gitCommand("pull");
exports.getBranchName = (...args) =>
  gitCommand("rev-parse", ["--abbrev-ref", "HEAD"])(
    ...args
  ).then(({ stdout }) => stdout.trim());

function gitCommand(cmd, baseArgs = []) {
  return function (repoDir, args = []) {
    return exec(`git ${cmd} ${baseArgs.concat(args).join(" ")}`, {
      cwd: repoDir,
    });
  };
}
