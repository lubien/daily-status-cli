# daily-status-cli

Update a repo with your daily status from PRs, issues and even gists.

## Usage

Head to a git repo and run:

```sh
$ daily-status -f Home.md
```

You will be asked a GitHub [Personal Access Token](https://github.com/settings/tokens) only at the first time.

```sh
Usage: daily-status [options]

Options:
  -V, --version                   output the version number
  -c, --config <string>           config file
  -f, --file <string>             markdown file to update
  -a, --api-key <string>          GitHub API key
  -d, --debug                     output extra debugging
  -r, --remote <string>           git remote name to pull/push. Default 'origin'
  --bad-labels <string...>        issues to ignore by default
  --bad-milestones <string...>    milestones to ignore by default
  --todo-labels <string...>       issues to mark as To Do
  --todo-milestones <string...>   milestones to mark as To Do
  --doing-labels <string...>      issues to mark as Doing
  --doing-milestones <string...>  milestones to mark as Doing
  -C, --custom <keyValue...>      custom option in the format KEY=VALUE
  -h, --help                      display help for command
```

If you want super powers, create your own [config file](config.template.js) so you can
go overboard customizing features then add `-c /path/to/config.js` when you run.
