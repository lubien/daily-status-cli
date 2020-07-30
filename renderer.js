const moment = require("moment");

const globalHelpers = {
  isPr,
  isIssue,
  hasAnyLabel,
  hasAnyMilestone,
  isGist,
  moment,
};

exports.renderFile = renderFile;

const othersSeparator =
  "##################  Nothing below will be commited  ##################";
const othersTemplate = `${othersSeparator}

**Issues:** 
{{OTHER_ISSUES}}

**PRs:** 
{{OTHER_PULL_REQUESTS}}

**Gists:** 
{{OTHER_GISTS}}`;

function renderFile(config, { user, prs, issues, gists }) {
  const { currentItems, todoItems, otherItems } = prs.concat(issues).reduce(
    (acc, item, index, items) => {
      const group = config.groupItem(item, config, globalHelpers, index, items);
      const realGroup =
        {
          current: "currentItems",
          todo: "todoItems",
        }[group] || "otherItems";
      acc[realGroup].push(item);
      return acc;
    },
    { currentItems: [], todoItems: [], otherItems: [] }
  );

  const currentIssues = currentItems.filter(isIssue);
  const todoIssues = todoItems.filter(isIssue);
  const otherIssues = otherItems.filter(isIssue);

  const currentPullRequests = currentItems.filter(isPr);
  const otherPullRequests = todoItems
    .filter(isPr)
    .concat(otherItems.filter(isPr));

  const data = {
    ...Object.entries(user).reduce((acc, [key, value]) => {
      acc["USER_" + key.toUpperCase()] = value;
      return acc;
    }, {}),

    custom: config.custom || {},

    currentIssues,
    CURRENT_ISSUES: applyArrayOfItemsTemplate(
      config,
      config.template,
      currentIssues
    ),

    todoIssues,
    TODO_ISSUES: applyArrayOfItemsTemplate(config, config.template, todoIssues),

    otherIssues,
    OTHER_ISSUES: applyArrayOfItemsTemplate(
      config,
      config.template,
      otherIssues
    ),

    currentPullRequests,
    CURRENT_PULL_REQUESTS: applyArrayOfItemsTemplate(
      config,
      config.template,
      currentPullRequests
    ),

    otherPullRequests,
    OTHER_PULL_REQUESTS: applyArrayOfItemsTemplate(
      config,
      config.template,
      otherPullRequests
    ),

    otherGists: gists,
    OTHER_GISTS: applyArrayOfItemsTemplate(config, config.template, gists),
  };
  const renderedOthers = applyTemplate(config, othersTemplate, data);

  const renderedContainer = applyTemplate(
    config,
    config.template.container,
    data
  );

  return [renderedContainer, "", renderedOthers].join("\n");
}

function hasAnyLabel(item, labels) {
  return (
    item.labels && item.labels.some((label) => labels.includes(label.name))
  );
}

function hasAnyMilestone(item, milestones) {
  return item.milestone && milestones.includes(item.milestone.title);
}

function isPr(item) {
  return !!item.pull_request;
}

function isGist(item) {
  return !!item.git_pull_url;
}

function isIssue(item) {
  return !isPr(item) && !isGist(item);
}

exports.renderMetaLine = renderMetaLine;
function renderMetaLine(key) {
  return `<a href="#daily-status-meta-${key}"></a>`;
}

exports.parseMetaLine = parseMetaLine;
function parseMetaLine(line) {
  const re = /\<a href="#daily-status-meta-(.+)"\>\<\/a>/;
  const match = re.exec(line);
  return match ? match[0] : "";
}

exports.prepareDailyForUser = prepareDailyForUser;
function prepareDailyForUser(config, user, body) {
  const userOnlyInput = removeOtherLines(body);
  const trimmed = userOnlyInput.trim();

  if (!trimmed.length) {
    return "";
  }

  const withMeta = [
    renderMetaLine(`user-${user.id}-start`),
    trimmed,
    "",
    config.template.personSeparator,
    "",
    renderMetaLine(`user-${user.id}-end`),
  ].join("\n");
  return withMeta;
}

function removeOtherLines(body) {
  const lines = body.split("\n");
  return lines.slice(0, lines.indexOf(othersSeparator)).join("\n");
}

exports.replaceDate = replaceDate;
function replaceDate(config, date, text) {
  const lines = text.split("\n");

  const dateStartMeta = renderMetaLine(`date-start`);
  const dateEndMeta = renderMetaLine(`date-end`);

  const start = lines.findIndex((line) => line.trim() === dateStartMeta);
  const end = lines.findIndex((line) => line.trim() === dateEndMeta);

  if (start > -1 && end === -1) {
    throw new Error("Could not find end of the date");
  }
  if (start === -1 && end > -1) {
    throw new Error("Could not find start of the date");
  }

  const renderedLines = applyTemplate(config, config.template.date, {
    DATE:
      typeof config.template.dateFormat === "function"
        ? config.template.dateFormat(moment(date))
        : moment(date).format(config.template.dateFormat),
  }).split("\n");

  const dateLines = [dateStartMeta, ...renderedLines, dateEndMeta];

  if (start > -1 && end > -1) {
    lines.splice(start, end - start + 1, ...dateLines);
    return lines.join("\n").trim();
  }

  return dateLines.concat(lines).join("\n");
}

exports.replaceUserStatus = replaceUserStatus;
function replaceUserStatus(config, user, text, userMarkup) {
  const lines = text.split("\n");
  const start = lines.findIndex(
    (line) => line.trim() === renderMetaLine(`user-${user.id}-start`)
  );
  const end = lines.findIndex(
    (line) => line.trim() === renderMetaLine(`user-${user.id}-end`)
  );

  if (start > -1 && end === -1) {
    throw new Error("Could not find end of this user status");
  }
  if (start === -1 && end > -1) {
    throw new Error("Could not find start of this user status");
  }

  const userLines = userMarkup.split("\n");

  if (start > -1 && end > -1) {
    lines.splice(start, end - start + 1, ...userLines);
    return lines.join("\n").trim();
  }

  return lines.concat(userLines).join("\n");
}

exports.applyArrayOfItemsTemplate = applyArrayOfItemsTemplate;
function applyArrayOfItemsTemplate(config, template, items) {
  return items
    .map((item) => applyItemTemplate(config, template, item))
    .join(template.itemSeparator);
}

exports.applyItemTemplate = applyItemTemplate;
function applyItemTemplate(config, template, item) {
  return applyTemplate(config, template.item, {
    ...item,
    NUMBER: item.number || item.id,
    TITLE: item.title || item.description,
    URL: item.html_url,
  });
}

exports.applyTemplate = applyTemplate;
function applyTemplate(config, template, data, helpers = globalHelpers) {
  if (typeof template === "function") {
    function t(key, innerData) {
      const templateToRender = config.template[key];
      if (!templateToRender) {
        throw new Error(`Invalid template ${key}`);
      }
      return applyTemplate(config, templateToRender, innerData, helpers);
    }
    return template(config, t, data, helpers);
  }

  return Object.entries(data).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\{\{${key}\}\}`, "g"), value);
  }, template);
}
