## ⚠️ @mgks/docmd [DEPRECATED]

⚠️ **THIS PACKAGE HAS BEEN RENAMED.** ⚠️

We have moved! Please use **[@docmd/core](https://www.npmjs.com/package/@docmd/core)** for all future updates.

## 🚨 Migration Guide

1. **Uninstall** the old package:
   ```bash
   npm uninstall -g @mgks/docmd
   ```

2. **Install** the new core:
   ```bash
   npm install -g @docmd/core
   ```

## What is this?
This package is a legacy wrapper. It currently forwards all commands to the new `@docmd/core` engine to prevent breaking existing CI/CD pipelines, but **it will not receive new features**.

Please update your scripts to use `@docmd/core`.