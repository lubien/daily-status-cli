module.exports = {
  isAutoTool: false,
  
  apiKeyFile: "~/.github.token",

  remote: "origin",
  file: "Home.md",

  // true / false / 'ask'
  reset: "ask",
  // true / false / 'ask'
  deploy: "ask",

  prsQueryExtra: "is:open author:@me",
  issuesQueryExtra: "is:open assignee:@me",
  gistsQueryExtra: "",
  queriesExtra: "sort:updated-desc",

  template: {
    date: "\n# {{DATE}}\n",

    // https://momentjs.com/docs/#/displaying/format/
    dateFormat: "DD-MM-YYYY",

    itemSeparator: ";\n",

    personSeparator: "---",

    container: `\
## {{USER_LOGIN}}

**Current issues:**
{{CURRENT_ISSUES}}

**Next issues:** 
{{TODO_ISSUES}}

**Status update:**

**PRs:** 
{{CURRENT_PULL_REQUESTS}}`,

    item: `[#{{NUMBER}} ({{TITLE}})]({{URL}})`,
  },

  badLabels: [],
  badMilestones: [],
  autoToDoLabels: [],
  autoToDoMilestones: [],
  autoDoingLabels: [],
  autoDoingMilestones: [],

  groupItem(
    item,
    config,
    { isPr, isIssue, hasAnyLabel, hasAnyMilestone },
    index,
    items
  ) {
    // You can also ignore items. Uncomment this:
    // if (someCondition) {
    //   return 'ignore'
    // }

    // Put on 'other' right away any red flag
    if (
      hasAnyLabel(item, config.badLabels) ||
      hasAnyMilestone(item, config.badMilestones)
    ) {
      return "other";
    }

    if (
      isPr(item) ||
      hasAnyLabel(item, config.autoDoingLabels) ||
      hasAnyMilestone(item, config.autoDoingMilestones)
    ) {
      return "current";
    }

    if (
      // Pull requests do not have 'todo'
      isIssue(item) &&
      (hasAnyLabel(item, config.autoToDoLabels) ||
        hasAnyMilestone(item, config.autoToDoMilestones))
    ) {
      return "todo";
    }
  },
};
