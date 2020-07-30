const path = require("path");
const fs = require("fs").promises;

exports.boolean = boolean;
function boolean(data, key) {
  if (typeof data !== "boolean") {
    throw new Error(`${key} must be boolean`);
  }
}

exports.string = string;
function string(data, key) {
  if (typeof data !== "string") {
    throw new Error(`${key} must be a string`);
  }
}

exports.object = object;
function object(data, key) {
  if (data === null || typeof data !== "object") {
    throw new Error(`${key} must be an object`);
  }
}

exports.arrayOfString = arrayOfString;
function arrayOfString(data, key) {
  if (!Array.isArray(data) || !data.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be an array of strings`);
  }
}

exports.gitRepository = gitRepository;
async function gitRepository(dir) {
  if (!(await existPath(path.join(dir, ".git")))) {
    throw new Error(`${dir} must be a git repository`);
  }
}

exports.file = file;
async function file(fileName) {
  if (!(await existPath(fileName))) {
    throw new Error(`${fileName} must exist`);
  }
}

function existPath(pathTo) {
  return fs.stat(pathTo).catch(() => false);
}
