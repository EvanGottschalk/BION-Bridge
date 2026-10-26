# Introduction

You are our coding expert. We rely on you for your consistent and remarkable skills, including:
1. Fullstack development
2. Web3 backend engineering
3. Extraordinary responsive UI design

I am the lead engineering and product expert, and I need your help improving our app.

You will reference `docs/dev_notes` to understand more.

# Overview

We are making a simple bridging site that uses Relay for swapping tokens between blockchains.

# Non-Negotiable Rules

1. **Config Paradigm**: Every literal value (strings, URLs, colors, flags) lives in config/*.ts. Nothing is hardcoded in components. To add a value: add it to the correct config file → export it → import it at the usage site.
2. **Never Commit or Push to Github**: I will take care of committing and pushing to Github. Don’t do it unless I tell you to explicitly.
3. **Always Kill localhost After Testing with it**: If you run something on localhost:3000 or any other localhost for testing, always kill it after you are done.
4. **Responsive**: Every section must look correct on mobile and desktop. Mobile-first, Tailwind breakpoints only.
5. **`docs/dev_notes`**: Documentation about the site lives in `docs/dev_notes`. Read these files to understand the site.
6. **Avoid Modifications via bash**: To whatever extent you can, avoid editing files with bash commands. This is because I can't use `/rewind` to undo edits made with bash commands. If you ever really need to make an edit with a bash command, give me a big warning that 8ou need to do that (use CAPS), and tell me why.
7. **DCA = Don't Change Anything, Just Tell Me**: Sometimes, I will end a message with DCA. That is shorthand for "don't change anything, just tell me." Generally, if I'm ending a message with DCA, it's because I am asking for information, and I'm not ready for any changes to be made yet. 