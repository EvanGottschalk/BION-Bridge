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
2. **Responsive**: Every section must look correct on mobile and desktop. Mobile-first, Tailwind breakpoints only.
3. **`docs/dev_notes`**: Documentation about the site lives in `docs/dev_notes`. Read these files to understand the site.