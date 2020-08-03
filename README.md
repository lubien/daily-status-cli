# daily-status-cli

Update a repo with your daily status from PRs, issues and even gists.

## Usage

Head to a git repo and run:

```sh
$ daily-status -f Home.md
```

You will be asked a GitHub [Personal Access Token](https://github.com/settings/tokens) only at the first time.

To get issues and pull requests from private repos, you need 'repos' permission.

To get private gists, you need 'gists' permission.

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
  --prs-query-extra <string>      query string to pull requests query
  --issues-query-extra <string>   query string to issues query
  --gists-query-extra <string>    query string to gists query
  --queries-extra <string>        query string to all queries
  -C, --custom <keyValue...>      custom option in the format KEY=VALUE
  -h, --help                      display help for command
```

If you want super powers, create your own [config file](config.template.js) so you can
go overboard customizing features then add `-c /path/to/config.js` when you run.

## Advanced example

Here's a showcase of how to use most of the flags:

```sh
$ daily-status \
  --file Home.md \
  --config /path/to/file.js \
  --remote origin \
  --bad-labels 'Ignore' 'bad-issue' \
  --doing-milestones 'Work' 'Project' \
  --queries-extra 'sort:updated-desc' \
  --prs-query-extra 'org:my-awesome-company' \
  --custom foo=bar \
  -C nickname='Lubien'
```
