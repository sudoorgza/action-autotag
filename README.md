# Autotag

This action will read a `package.json` file and compare the `version` attribute to the project's known tags. If a corresponding tag does not exist, it will be created.

This tag works well in combination with:

- [actions/create-release](https://github.com/actions/create-release) (Auto-release)
- [author/action-publish](https://github.com/author/action-publish) (Auto-publish JavaScript/Node modules)
- [author/action-rollback](https://github.com/author/action-rollback) (Auto-rollback releases on failures)
- [author/template-cross-runtime](https://github.com/author/template-cross-runtime) (a cross-runtime JavaScript repo template)

## Usage

The following is an example `.github/workflows/main.yml` that will execute when a `push` to the `master` branch occurs.

```yaml
name: Create Tag

on:
  push:
    branches:
      - master

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: sudoorgza/action-autotag@stable
        with:
          github_token: "${{ secrets.GITHUB_TOKEN }}"
```

To make this work, the workflow must have the checkout action _before_ the autotag action.

This **order** is important!

```yaml
- uses: actions/checkout@v2
- uses: sudoorgza/action-autotag@stable
```

> If the repository is not checked out first, the autotagger cannot find the package.json file.

## Configuration

The `GITHUB_TOKEN` must be passed in. Without this, it is not possible to create a new tag. Make sure the autotag action looks like the following example:

```yaml
- uses: sudoorgza/action-autotag@stable
  with:
    github_token: "${{ secrets.GITHUB_TOKEN }}"
```

The action will automatically extract the token at runtime. **DO NOT MANUALLY ENTER YOUR TOKEN.** If you put the actual token in your workflow file, you'll make it accessible (in plaintext) to anyone who ever views the repository (it will be in your git history).

### Optional Configurations

There are several options to customize how the tag is created.

1. `github_token`

   By default, will use GITHUB_TOKEN or INPUT_GITHUB_TOKEN from the environment variables.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
   ```

1. `package_root`

   By default, autotag will look for the `package.json` file in the project root. If the file is located in a subdirectory, this option can be used to point to the correct file.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       package_root: "/path/to/subdirectory"
   ```

1. `overwrite`

   By default, pre-existing tags will not be overwritten. Set 'overwrite' to 'true' to overwrite any existing tags.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       overwrite: "true"
   ```

1. `tag_prefix`

   By default, `package.json` uses [semantic versioning](https://semver.org/), such as `1.0.0`. A prefix can be used to add text before the tag name. For example, if `tag_prefix` is set to `v`, then the tag would be labeled as `v1.0.0`.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       tag_prefix: "v"
   ```

1. `tag_suffix`

   Text can also be applied to the end of the tag by setting `tag_suffix`. For example, if `tag_suffix` is ` (beta)`, the tag would be `1.0.0 (beta)`. Please note this example violates semantic versioning and is merely here to illustrate how to add text to the end of a tag name if you _really_ want to.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       tag_suffix: " (beta)"
   ```

1. `tag_message`

   This is the annotated commit message associated with the tag. By default, a
   changelog will be generated from the commits between the latest tag and the new tag (HEAD). Setting this option will override it witha custom message.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       tag_message: "Custom message goes here."
   ```

1. `changelog_structure`

   Provide a custom changelog format when not using `tag_message`.
   This can interpolate strings, supported strings are `{{message}}`, `{{messageHeadline}}`, `{{author}}` and `{{sha}}`.
   Defaults to `**1) {{message}}** {{author}}\n(SHA: {{sha}})\n`.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       changelog_structure: "**{{messageHeadline}}** {{author}}\n"
   ```

1. `version`

   Explicitly set the version instead of automatically detecting from `package.json`.
   Useful for non-JavaScript projects where version may be output by a previous action.

   ```yaml
   - uses: sudoorgza/action-autotag@stable
     with:
       github_token: "${{ secrets.GITHUB_TOKEN }}"
       version: "${{ steps.previous_step.outputs.version }}"
   ```

## Developer Notes

If you are building an action that runs after this one, be aware this action produces several [outputs](https://help.github.com/en/articles/metadata-syntax-for-github-actions#outputs):

1. `tagname` will be empty if no tag was created, or it will be the value of the new tag.
1. `tagsha`: The SHA of the new tag.
1. `taguri`: The URI/URL of the new tag reference.
1. `tagmessage`: The messge applied to the tag reference (this is what shows up on the tag screen on Github).
1. `version` will be the version attribute found in the `package.json` file.

---

## Credits

This action was originally created by [Corey Butler](https://github.com/coreybutler) and extended by [Klemensas](https://github.com/Klemensas).
