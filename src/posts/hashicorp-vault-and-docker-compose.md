# Hashicorp Vault and docker-compose

## Intro

Hello everyone,

This time I wanted to cover how I use Hashicorp's [Vault](https://www.hashicorp.com/products/vault) to manage secrets used by docker-compose.

I've been using docker-compose to deploy the services I run on my home servers (I have 2 machines that host the services and Kubernetes was overkill) for a bit over 4 years now. The overall setup has served me well with it being simple and straight forward to deploy new services or update existing ones. All the compose files are stored in a git repo. The structure of the repo allows me to define "services" which are individual `docker-compose.yml` files that define a set of containers which together gives me a service I want to host at home.

I control variables that are shared between these services, but change based on the machine hosting it (Usually just the domain name change) via `{{ hostname }}.env` files. This has been working for me though one major downside is that the .env file can't be committed to git due to it containing secrets such as api keys.

This is where I've been leveraging vault and specifically [vault agent](https://developer.hashicorp.com/vault/docs/agent-and-proxy/agent) to template the `.env` file, so I can push the `.env` template but not the secrets themselves.

Vault agent is capable of templating a file using go template syntax and generates the files with data from vault.

To do this we need a few things, first you need a running vault instance. I would recommend following the great docs from Hasicorp which you can find [here](https://developer.hashicorp.com/vault).

## Vault Setup

I have it setup as a service defined in docker-compose. A really simplistic example of the `docker-compose.yml` file:

```yaml
version: "3.8"
services:
  vault:
    build: ./vault
    command:
      - server
    cap_add:
      - IPC_LOCK
    ports:
      - 8200:8200
    volumes:
      - /path/to/where/you/want/to/save/your/vault/data:/vault/data
    restart: always
```

With `./vault` containing the following:

Dockerfile:

```Dockerfile
FROM vault:latest
ADD config.hcl /vault/config/config.hcl
```

config.hcl:

```go
storage "file" {
    path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = "true"
}

api_addr = "http://localhost:8200"
ui = true
```

## Using Vault for storing secrets

So now we have vault running we can create secrets to do this we need the cli tool (You can do it via the WebUI, but I would recommend getting comfortable with the cli tool)

Creating a secret:

```bash
vault kv put kv/services/example apikey="super_secret_api_key"
# I would recommend prefixing the command with a space
# this will prevent it from saving it to your bash history
```

Once we have a secret created we can use it with the `vault agent`.
We first need to create a `agent-config.hcl` in which you will define the files you want to template:

```go
auto_auth {
   method {
      type = "token_file"

      config {
        #Make sure to update this to the path of your home directory
        token_filce_path = "/home/username/.vault-token"
      }
   }
}

vault {
  #Update this with the address of your vault instance
  address = "http://localhost:8200"
  retry {
    num_retries = 5
  }
}

# Forces agent to close after generating the files
exit_after_auth = true

template {
  source = "example.env.ctmpl"
  destination = "example.env"
}
```

Next you need to define the template file `example.env.ctmpl`:

```bash
MY_NON_TEMPLATED_VAR=BLAH

{{ with secret "kv/services/example" }}
MY_SECRET_API_KEY={{ .Data.data.apikey }}
{{ end }}
```

This will fetch the `services/example` secret from the [kv](https://developer.hashicorp.com/vault/docs/secrets/kv/kv-v2) engine and write the value of the key `apikey`.

Generating us a file that looks like this:

```bash
MY_NON_TEMPLATED_VAR=BLAH
MY_SECRET_API_KEY=super_secret_api_key
```

docker-compose can now refer to that file making the secret available to the containers.

## Conclusion

As you can see with Hashicorp vault its possible to generate `.env` files which can be used by your apps or in this case by docker-compose.

###### Last updated 2023-07-05

<!-- begin comments -->
<!-- comment blacklist -->
<script>BBB_MASTODON_COMMENTS_BLACKLIST = new Set([]);</script>
<h2>Comments</h2>
<a id="comments-view" href="https://fosstodon.org/@chimbosonic/110662190154487088" data-comments-id="110662190154487088">View Comments</a>
<a id="comments-reply" href="https://fosstodon.org/@chimbosonic/110662190154487088">Reply</a>
<div id="comments-container"></div>
<div id="comments-cta">Click on "View Comments" to see the comments.</div>
<!-- end comments -->
