const core = require("@actions/core");
const { GitHub, context } = require("@actions/github");
const fs = require("fs");
const path = require("path");
const os = require("os");

async function run() {
  try {
    core.debug(
      ` Available environment variables:\n -> ${Object.keys(process.env)
        .map((i) => i + " :: " + process.env[i])
        .join("\n -> ")}`
    );

    const dir = fs
      .readdirSync(path.resolve(process.env.GITHUB_WORKSPACE), {
        withFileTypes: true,
      })
      .map((entry) => {
        return `${entry.isDirectory() ? "> " : "  - "}${entry.name}`;
      })
      .join("\n");

    core.debug(` Working Directory: ${process.env.GITHUB_WORKSPACE}:\n${dir}`);

    const githubToken = core.getInput("github_token", { required: false }) || process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN

    if (!githubToken) {
      core.setFailed("Invalid or missing github token.");
      return;
    }

    const pkg_root = core.getInput("package_root", { required: false });
    const pkgfile = path.join(
      process.env.GITHUB_WORKSPACE,
      pkg_root,
      "package.json"
    );
    if (!fs.existsSync(pkgfile)) {
      core.setFailed("package.json does not exist.");
      return;
    }

    const pkg = require(pkgfile);
    core.setOutput("version", pkg.version);
    core.debug(` Detected version ${pkg.version}`);

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const github = new GitHub(githubToken);

    // Get owner and repo from context of payload that triggered the action
    const { owner, repo } = context.repo;

    // // Check for existing tag
    // const git = new github.GitHub(process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN)
    // const owner = process.env.GITHUB_REPOSITORY.split('/').shift()
    // const repo = process.env.GITHUB_REPOSITORY.split('/').pop()

    const tags = [];
    try {
      let results = await github.repos.listTags({
        owner,
        repo,
        per_page: 100,
      });
      let page = 1
      while(results && results.data && results.data.length > 0) {
        tags.push(...results.data)
        results = await github.repos.listTags({
          owner,
          repo,
          per_page: 100,
          page: ++page
        });
      }
    } catch (e) {
      core.warning(`Unable to retrieve all tags ERROR:${e.message}` + os.EOL);
    }

    const overwriteInput = core.getInput("overwrite", { required: false });
    const overwrite = overwriteInput
      ? overwriteInput.toLowerCase() === "true"
      : false;
    const tagPrefix = core.getInput("tag_prefix", { required: false }) || 'v';
    const tagSuffix = core.getInput("tag_suffix", { required: false });
    const changelogStructure = core.getInput("changelog_structure", {
      required: false,
    });

    const getTagName = (version) => {
      return `${tagPrefix}${version}${tagSuffix}`;
    };

    let existingTag

    for (let tag of tags) {
      if (tag.name === getTagName(pkg.version)) {
        core.warning(`"${tag.name.trim()}" tag already exists.` + os.EOL);
        existingTag = tag
        break;
      }
    }

    if (!overwrite && existingTag) {
      return;
    }

    // Create the new tag name
    const tagName = getTagName(pkg.version);

    let tagMsg = core.getInput("tag_message", { required: false }).trim();
    if (tagMsg.length === 0 && tags.length > 0) {
      try {
        latestTag = tags.shift();

        let changelog = await github.repos.compareCommits({
          owner,
          repo,
          base: latestTag.name,
          head: "master",
        });
        const structure =
          changelogStructure ||
          `**1) {{message}}** {{author}}\n(SHA: {{sha}})\n`;

        tagMsg = changelog.data.commits
          .map((commit) =>
            structure.replace(
              /({{message}})|({{messageHeadline}})|({{author}})|({{sha}})/g,
              (match, message, messageHeadline, author, sha) => {
                if (message) return commit.commit.message;
                if (messageHeadline)
                  return commit.commit.message.split("\n")[0];
                if (author)
                  return !commit.hasOwnProperty("author") ||
                    !commit.author.hasOwnProperty("login")
                    ? ""
                    : commit.author.login;
                if (sha) return commit.sha;
              }
            )
          )
          .join("\n");
      } catch (e) {
        core.warning(
          "Failed to generate changelog from commits: " + e.message + os.EOL
        );
        tagMsg = tagName;
      }
    }

    let newTag;
    try {
      tagMsg = tagMsg.trim().length > 0 ? tagMsg : `Version ${pkg.version}`;

      newTag = await github.git.createTag({
        owner,
        repo,
        tag: tagName,
        message: tagMsg,
        object: process.env.GITHUB_SHA,
        type: "commit",
      });

      core.warning(`Created new tag: ${newTag.data.tag}`);
    } catch (e) {
      core.setFailed(e.message);
      return;
    }

    let newReference;
    try {
      if (existingTag) {
        core.warning(
          `Updating old reference to ${newTag.data.tag} SHA ${newTag.data.sha}` +
            os.EOL
        );
        try {
          newReference = await github.git.updateRef({
            owner,
            repo,
            ref: `tags/${newTag.data.tag}`,
            sha: newTag.data.sha,
            force: true
          })  
          core.warning(`Updated tags/${newTag.data.tag}` + os.EOL);
        } catch (error) {
          core.warning(
            `Unable to update old reference to tags/${newTag.data.tag} SHA ${newTag.data.sha} ERROR:${error.message}` +
              os.EOL
          );  
        }
      }
      if (!newReference) {
        newReference = await github.git.createRef({
          owner,
          repo,
          ref: `refs/tags/${newTag.data.tag}`,
          sha: newTag.data.sha,
        });  
      }

      core.warning(
        `Reference ${newReference.data.ref} available at ${newReference.data.url}` +
          os.EOL
      );
    } catch (e) {
      core.warning(`Unable to create new reference refs/tags/${newTag.data.tag} sha ${newTag.data.sha} repo ${repo}` + os.EOL);

      core.setFailed(e.message);
      return;
    }

    // Store values for other actions
    if (typeof newTag === "object" && typeof newReference === "object") {
      core.setOutput("tagname", tagName);
      core.setOutput("tagsha", newTag.data.sha);
      core.setOutput("taguri", newReference.data.url);
      core.setOutput("tagmessage", tagMsg.trim());
      core.setOutput("tagref", newReference.data.ref);
    }
  } catch (error) {
    core.warning(error.message);
    core.setOutput("tagname", "");
    core.setOutput("tagsha", "");
    core.setOutput("taguri", "");
    core.setOutput("tagmessage", "");
    core.setOutput("tagref", "");
  }
}

run();
