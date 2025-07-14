## boreDOM CLI

To build this, just run `make` in the parent folder.

This command will create the binary .js for boreDOM CLI that contains the
boredom .js code bundled in it.

After that, you can install boredom locally by running `npm link` in this
folder. Or just install with a package manager in a project.

### How does this code work?

The final output is `boreDOM.js` which is a node CLI tool bundled with all
dependencies.

To produce this file, the command `pnpm run build` must be run.

The source of truth for the whole CLI code is `cli.js`, this file is used as the
base to generate the intermediate output which is `generated_cli.js` which is
then bundled with all the dependencies in the final `boreDOM.js`.

This process to generate the `generated_cli.js` is done at the parent folder by
running `pnpm run build_cli`.
