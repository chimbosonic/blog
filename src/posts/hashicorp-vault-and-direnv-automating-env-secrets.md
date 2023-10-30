# Hashicorp Vault and direnv automating env secrets

In my last post I cover how I generated `.env` files using `vault agent`, and after a few weeks I discovered that you can leverage Hashicorp [vault](https://developer.hashicorp.com/vault) and [direnv](https://direnv.net/) to automatically fetch secrets and make them available in your shell's env when you move to a directory containing a `.envrc`. With this I can setup git repos for colleagues where they can then run things like tests locally without them having to manually fetch secrets from vault or our organisation's password manager.

So to set it up you need to install direnv and have your Vault access setup. You can find the direnv instructions [here](https://direnv.net/docs/installation.html) and the vault instructions [here](https://developer.hashicorp.com/vault)

You can now create a secret on vault for example:

```bash
vault kv put -mount=secret test test-key=yourkey
# Don't forget you can put a space infront of this command and it won't save it to your bash history
# You can also read from stdin or use the web console
cat secret | vault kv put -mount=secret test test-key=-
```

Now you can create a `.envrc` file in your project directory and create a named variable that executes a `vault get`:

```bash
export MYSECRET=$(vault kv get -mount=secret -field=test-key test)
```

Now if you setup direnv and hooked it into your shell for bash : `eval "$(direnv hook bash)"`
When you  move to that directory direnv will load that `.envrc` file into your shell's env.
N.B.: Make sure you have run `direnv allow .` on the directory otherwise direnv will not load the env files.

###### Last updated 2023-07-13
