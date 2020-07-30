module.exports = {
  remote: "origin",
  file: "Home.md",

  prsQueryExtra: "is:open",
  issuesQueryExtra: "is:open",
  gistsQueryExtra: "",
  queriesExtra: "sort:updated-desc author:@me",

  template: {
    date: "\n# {{DATE}}\n",

    // https://momentjs.com/docs/#/displaying/format/
    dateFormat: "DD-MM-YYYY",

    itemSeparator: ";\n",

    personSeparator: "---",

    container: `\
**Current issues:**
{{CURRENT_ISSUES}}

**Next issues:** 
{{TODO_ISSUES}}

**Status update:**

**PRs:** 
{{PULL_REQUESTS}}`,

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
    // Ignore right away any red flag
    if (
      hasAnyLabel(item, config.badLabels) ||
      hasAnyMilestone(item, config.badMilestones)
    ) {
      return;
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
